use crate::file_tree::{self, FileNode};
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
    let root = file_tree::resolve_root(&p);
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
