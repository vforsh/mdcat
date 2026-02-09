use crate::file_tree::{self, FileNode};
use crate::file_watcher;
use crate::instance_registry;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct OpenedFile(pub Mutex<Option<String>>);
pub struct CurrentRoot(pub Mutex<Option<String>>);

#[derive(serde::Serialize)]
pub struct FileContext {
    pub root: String,
    pub is_git: bool,
}

#[tauri::command]
pub fn get_context(path: String) -> Result<FileContext, String> {
    let p = PathBuf::from(&path);
    let git_root = file_tree::detect_git_root(&p);
    let is_git = git_root.is_some();
    let root = file_tree::resolve_root(&p, git_root.clone());
    Ok(FileContext {
        root: root.to_string_lossy().to_string(),
        is_git,
    })
}

#[tauri::command]
pub fn get_file_tree(root: String) -> Result<Vec<FileNode>, String> {
    let p = PathBuf::from(&root);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", root));
    }
    Ok(file_tree::build_md_tree(&p))
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

#[tauri::command]
pub fn save_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    std::fs::write(&p, "").map_err(|e| format!("Failed to create {}: {}", path, e))
}

#[tauri::command]
pub fn rename_file(old_path: String, new_path: String) -> Result<(), String> {
    let new_p = PathBuf::from(&new_path);
    if let Some(parent) = new_p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {}", e))?;
    }
    std::fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename {} → {}: {}", old_path, new_path, e))
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete {}: {}", path, e))
}

#[tauri::command]
pub fn get_opened_file(state: State<'_, OpenedFile>) -> Option<String> {
    // First check internal state
    if let Some(file) = state.0.lock().ok()?.take() {
        eprintln!("[mdcat] get_opened_file (state): {:?}", file);
        return Some(file);
    }

    // Then check cross-instance queue
    let queued = instance_registry::take_queued_files();
    if let Some(file) = queued.into_iter().next() {
        eprintln!("[mdcat] get_opened_file (queue): {:?}", file);
        return Some(file);
    }

    None
}

#[tauri::command]
pub fn set_current_root(root: String, state: State<'_, CurrentRoot>) {
    // Unregister old root if any
    if let Ok(lock) = state.0.lock() {
        if let Some(ref old_root) = *lock {
            instance_registry::unregister_root(old_root);
        }
    }

    // Register new root
    instance_registry::register_root(&root);

    // Update state
    if let Ok(mut lock) = state.0.lock() {
        *lock = Some(root);
    }
}

#[tauri::command]
pub fn get_current_root(state: State<'_, CurrentRoot>) -> Option<String> {
    state.0.lock().ok()?.clone()
}

#[tauri::command]
pub fn watch_file(path: String, app: tauri::AppHandle) -> Result<(), String> {
    file_watcher::watch(&path, app)
}

#[tauri::command]
pub fn unwatch_file() {
    file_watcher::unwatch();
}

#[tauri::command]
pub fn dump_state_to_file(state_json: String) -> Result<(), String> {
    let dir = std::env::temp_dir();
    let path = dir.join("mdcat-state.json");
    std::fs::write(&path, &state_json)
        .map_err(|e| format!("Failed to write state dump: {}", e))
}

/// Benchmark hook: if `MDCAT_BENCH_SENTINEL` is set, write a sentinel file once the frontend decides
/// "first paint" happened. No-op unless the env var is present.
#[tauri::command]
pub fn bench_ready() -> Result<(), String> {
    let path = match std::env::var("MDCAT_BENCH_SENTINEL") {
        Ok(p) if !p.is_empty() => p,
        _ => return Ok(()),
    };

    let sentinel = PathBuf::from(path);
    if let Some(parent) = sentinel.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let pid = std::process::id();
    let ts_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let payload = format!("{{\"pid\":{},\"ts_ms\":{}}}\n", pid, ts_ms);

    // Best-effort atomic write: write to temp file then rename.
    let tmp = sentinel.with_extension("tmp");
    std::fs::write(&tmp, payload)
        .and_then(|_| std::fs::rename(&tmp, &sentinel))
        .map_err(|e| format!("Failed to write bench sentinel {:?}: {}", sentinel, e))
}
