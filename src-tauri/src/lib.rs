mod commands;
mod file_tree;

use commands::OpenedFile;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_cli::CliExt;

pub fn run() {
    let opened_file: OpenedFile = OpenedFile(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(opened_file)
        .invoke_handler(tauri::generate_handler![
            commands::get_context,
            commands::get_file_tree,
            commands::read_file,
            commands::save_file,
            commands::get_opened_file,
        ])
        .setup(|app| {
            // Handle CLI args
            if let Ok(matches) = app.cli().matches() {
                if let Some(arg) = matches.args.get("file") {
                    if let serde_json::Value::String(ref path) = arg.value {
                        if !path.is_empty() {
                            let p = path.clone();
                            let state = app.state::<OpenedFile>();
                            let mut lock = state.0.lock().unwrap();
                            *lock = Some(p);
                        }
                    }
                }
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
                        let state = app.state::<OpenedFile>();
                        if let Ok(mut lock) = state.0.lock() {
                            *lock = Some(path_str.clone());
                        }
                        // Emit event to frontend
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("open-file", path_str);
                        }
                    }
                }
            }
            let _ = (&app, &event); // suppress unused warnings on non-macOS
        });
}
