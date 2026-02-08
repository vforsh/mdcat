use notify_debouncer_mini::{new_debouncer, DebouncedEventKind};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::Emitter;

static WATCHER: Mutex<Option<notify_debouncer_mini::Debouncer<notify::RecommendedWatcher>>> =
    Mutex::new(None);

pub fn watch(path: &str, app: tauri::AppHandle) -> Result<(), String> {
    unwatch();

    let file_path = Path::new(path).to_path_buf();
    let filename = file_path
        .file_name()
        .ok_or("Invalid file path")?
        .to_os_string();
    let dir = file_path
        .parent()
        .ok_or("Cannot get parent directory")?
        .to_path_buf();

    let mut debouncer = new_debouncer(
        Duration::from_millis(200),
        move |res: Result<Vec<notify_debouncer_mini::DebouncedEvent>, notify::Error>| {
            if let Ok(events) = res {
                let relevant = events.iter().any(|e| {
                    e.kind == DebouncedEventKind::Any
                        && e.path.file_name() == Some(&filename)
                });
                if relevant {
                    let _ = app.emit("file-changed", ());
                }
            }
        },
    )
    .map_err(|e| format!("Failed to create watcher: {}", e))?;

    debouncer
        .watcher()
        .watch(&dir, notify::RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch directory: {}", e))?;

    let mut lock = WATCHER.lock().map_err(|e| e.to_string())?;
    *lock = Some(debouncer);

    Ok(())
}

pub fn unwatch() {
    if let Ok(mut lock) = WATCHER.lock() {
        *lock = None;
    }
}
