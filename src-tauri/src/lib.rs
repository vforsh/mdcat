mod commands;
mod file_tree;
mod file_watcher;
mod instance_registry;

use commands::{CurrentRoot, OpenedFile};
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};
use tauri_plugin_cli::CliExt;

fn format_build_date_local(build_date_utc: &str) -> String {
    use time::format_description::well_known::Rfc3339;
    use time::macros::format_description;
    use time::{OffsetDateTime, UtcOffset};

    // Input is expected to be RFC3339 UTC: 2026-02-09T09:22:07Z
    let dt_utc = match OffsetDateTime::parse(build_date_utc, &Rfc3339) {
        Ok(dt) => dt,
        Err(_) => return build_date_utc.to_string(),
    };

    let offset = UtcOffset::current_local_offset().unwrap_or(UtcOffset::UTC);
    let dt_local = dt_utc.to_offset(offset);

    // Example: 2026-02-09 01:22:07 -0800
    let fmt = format_description!("[year]-[month]-[day] [hour]:[minute]:[second] [offset_hour sign:mandatory][offset_minute]");
    dt_local
        .format(&fmt)
        .unwrap_or_else(|_| build_date_utc.to_string())
}

pub fn run() {
    let opened_file: OpenedFile = OpenedFile(Mutex::new(None));
    let current_root: CurrentRoot = CurrentRoot(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(opened_file)
        .manage(current_root)
        .invoke_handler(tauri::generate_handler![
            commands::get_context,
            commands::get_file_tree,
            commands::read_file,
            commands::save_file,
            commands::get_opened_file,
            commands::set_current_root,
            commands::get_current_root,
            commands::create_file,
            commands::rename_file,
            commands::delete_file,
            commands::watch_file,
            commands::unwatch_file,
            commands::dump_state_to_file,
            commands::bench_ready,
        ])
        .setup(|app| {
            // Native menubar (macOS): show build date/sha in the application menu.
            //
            // Note: on macOS the global menubar can only contain Submenus at the root.
            let handle = app.handle();
            let build_date = option_env!("MDCAT_BUILD_DATE_UTC").unwrap_or("unknown");
            let git_sha = option_env!("MDCAT_GIT_SHA").unwrap_or("unknown");
            let build_label = if build_date == "unknown" {
                format!("Build: unknown ({})", git_sha)
            } else {
                let local = format_build_date_local(build_date);
                format!("Build: {} ({})", local, git_sha)
            };

            let build_item = MenuItem::with_id(handle, "build-info", build_label, false, None::<&str>)?;

            let app_menu = SubmenuBuilder::new(handle, "mdcat")
                .about(None)
                .separator()
                .item(&build_item)
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(handle, "Edit")
                .cut()
                .copy()
                .paste()
                .separator()
                .select_all()
                .build()?;

            let menu = MenuBuilder::new(handle)
                .item(&app_menu)
                .item(&edit_menu)
                .build()?;

            let _ = app.set_menu(menu);

            // Try tauri-plugin-cli first
            let mut file_path: Option<String> = None;
            if let Ok(matches) = app.cli().matches() {
                if let Some(arg) = matches.args.get("file") {
                    if let serde_json::Value::String(ref path) = arg.value {
                        if !path.is_empty() {
                            file_path = Some(path.clone());
                        }
                    }
                }
            }

            // Fallback: scan raw args for a .md file path (handles tauri dev extra flags)
            if file_path.is_none() {
                for arg in std::env::args().skip(1) {
                    if arg.starts_with('-') {
                        continue;
                    }
                    let p = std::path::Path::new(&arg);
                    if p.is_file() {
                        file_path = Some(arg);
                        break;
                    }
                }
            }

            if let Some(path) = file_path {
                // Store for get_opened_file fallback
                let state = app.state::<OpenedFile>();
                let mut lock = state.0.lock().unwrap();
                *lock = Some(path.clone());
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &event {
                // macOS "Open With" sends file:// URLs
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        let path_str = path.to_string_lossy().to_string();

                        // Get new file's git root
                        let new_root = file_tree::detect_git_root(&path)
                            .map(|p| p.to_string_lossy().to_string());

                        // Get current root from state
                        let current_root = app
                            .state::<CurrentRoot>()
                            .0
                            .lock()
                            .ok()
                            .and_then(|g| g.clone());

                        // Decide: same root → switch file, different → new window
                        eprintln!("[mdcat] new_root={:?}, current_root={:?}", new_root, current_root);
                        let same_root = match (&new_root, &current_root) {
                            (Some(new), Some(cur)) => new == cur,
                            (None, None) => true, // both non-git, reuse window
                            _ => false,
                        };
                        eprintln!("[mdcat] same_root={}", same_root);

                        if same_root || current_root.is_none() {
                            // Store in state (fallback for fresh launch)
                            let state = app.state::<OpenedFile>();
                            if let Ok(mut lock) = state.0.lock() {
                                eprintln!("[mdcat] storing file in state: {}", path_str);
                                *lock = Some(path_str.clone());
                            }
                            // Also emit event (for when app is already running)
                            eprintln!("[mdcat] emitting open-file event: {}", path_str);
                            let _ = app.emit("open-file", &path_str);
                            // Focus window
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.set_focus();
                            }
                        } else if let Some(ref root) = new_root {
                            // Check if another instance owns this repo
                            if let Some(owner_pid) = instance_registry::find_owner(root) {
                                // Queue file for the owning instance
                                eprintln!(
                                    "[mdcat] queueing file for instance {} (owns {})",
                                    owner_pid, root
                                );
                                instance_registry::queue_file_for_instance(&path_str, owner_pid);
                            } else {
                                // No owner - spawn new instance
                                eprintln!("[mdcat] spawning new instance for {}", root);
                                if let Ok(exe) = std::env::current_exe() {
                                    let _ = std::process::Command::new(exe)
                                        .arg(&path_str)
                                        .spawn();
                                }
                            }
                        } else {
                            // Non-git file, different from current - spawn new instance
                            if let Ok(exe) = std::env::current_exe() {
                                let _ = std::process::Command::new(exe)
                                    .arg(&path_str)
                                    .spawn();
                            }
                        }
                    }
                }
            }
            let _ = (&app, &event); // suppress unused warnings on non-macOS
        });
}
