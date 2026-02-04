//! Cross-instance coordination for mdcat.
//! Tracks which git roots are open in which process via lock files.
//! Uses file-based queues for cross-instance file opening.

use std::collections::hash_map::DefaultHasher;
use std::fs::{self, OpenOptions};
use std::hash::{Hash, Hasher};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::process::Command;

fn registry_dir() -> PathBuf {
    let dir = std::env::temp_dir().join("mdcat-instances");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn lock_file_for_root(root: &str) -> PathBuf {
    let mut hasher = DefaultHasher::new();
    root.hash(&mut hasher);
    let hash = hasher.finish();
    registry_dir().join(format!("{:x}.lock", hash))
}

fn queue_file_for_pid(pid: u32) -> PathBuf {
    registry_dir().join(format!("{}.queue", pid))
}

/// Register this process as the owner of a git root.
pub fn register_root(root: &str) {
    let lock_path = lock_file_for_root(root);
    let pid = std::process::id();
    if let Ok(mut file) = fs::File::create(&lock_path) {
        let _ = writeln!(file, "{}\n{}", pid, root);
    }
    eprintln!("[mdcat] registered root: {} (pid {})", root, pid);
}

/// Unregister this process's root (call on exit).
pub fn unregister_root(root: &str) {
    let lock_path = lock_file_for_root(root);
    let pid = std::process::id();

    // Only remove if we own it
    if let Ok(contents) = fs::read_to_string(&lock_path) {
        if let Some(first_line) = contents.lines().next() {
            if first_line.parse::<u32>().ok() == Some(pid) {
                let _ = fs::remove_file(&lock_path);
            }
        }
    }

    // Also remove our queue file
    let _ = fs::remove_file(queue_file_for_pid(pid));
}

/// Check if a root is owned by another running process.
/// Returns the PID if found and the process is still alive.
pub fn find_owner(root: &str) -> Option<u32> {
    let lock_path = lock_file_for_root(root);
    let my_pid = std::process::id();

    let mut file = fs::File::open(&lock_path).ok()?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).ok()?;

    let pid: u32 = contents.lines().next()?.parse().ok()?;

    // Don't return our own PID
    if pid == my_pid {
        return None;
    }

    // Check if process is still alive
    if is_process_alive(pid) {
        Some(pid)
    } else {
        // Stale lock file, remove it
        let _ = fs::remove_file(&lock_path);
        None
    }
}

fn is_process_alive(pid: u32) -> bool {
    // Use kill -0 to check if process exists
    Command::new("kill")
        .args(["-0", &pid.to_string()])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Queue a file to be opened by another instance and activate that instance.
pub fn queue_file_for_instance(file_path: &str, target_pid: u32) -> bool {
    let queue_path = queue_file_for_pid(target_pid);
    eprintln!(
        "[mdcat] queueing {} for pid {}",
        file_path, target_pid
    );

    let queued = match OpenOptions::new()
        .create(true)
        .append(true)
        .open(&queue_path)
    {
        Ok(mut file) => writeln!(file, "{}", file_path).is_ok(),
        Err(_) => false,
    };

    if queued {
        // Activate the target instance's window using AppleScript
        let _ = Command::new("osascript")
            .args([
                "-e",
                &format!(
                    "tell application \"System Events\" to set frontmost of (first process whose unix id is {}) to true",
                    target_pid
                ),
            ])
            .status();
    }

    queued
}

/// Read and clear the queue for this process.
pub fn take_queued_files() -> Vec<String> {
    let pid = std::process::id();
    let queue_path = queue_file_for_pid(pid);

    let contents = match fs::read_to_string(&queue_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    // Clear the queue
    let _ = fs::remove_file(&queue_path);

    contents
        .lines()
        .filter(|l| !l.is_empty())
        .map(|s| s.to_string())
        .collect()
}
