mod commands;
mod file_tree;
mod instance_registry;

use commands::{CurrentRoot, OpenedFile};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_cli::CliExt;

pub fn run() {
    let opened_file: OpenedFile = OpenedFile(Mutex::new(None));
    let current_root: CurrentRoot = CurrentRoot(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
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
        ])
        .setup(|app| {
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

                // Emit event after window is ready
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    // Small delay to ensure frontend listener is ready
                    std::thread::sleep(std::time::Duration::from_millis(50));
                    let _ = app_handle.emit("open-file", &path);
                });
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
