use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

/// Detect git repo root by running `git rev-parse --show-toplevel`.
pub fn detect_git_root(path: &Path) -> Option<PathBuf> {
    let dir = if path.is_file() {
        path.parent()?
    } else {
        path
    };

    let output = Command::new("git")
        .arg("rev-parse")
        .arg("--show-toplevel")
        .current_dir(dir)
        .output()
        .ok()?;

    if output.status.success() {
        let root = String::from_utf8(output.stdout).ok()?.trim().to_string();
        Some(PathBuf::from(root))
    } else {
        None
    }
}

/// Resolve context root: git root or parent dir of the file.
pub fn resolve_root(path: &Path) -> PathBuf {
    detect_git_root(path).unwrap_or_else(|| {
        if path.is_file() {
            path.parent()
                .unwrap_or(path)
                .to_path_buf()
        } else {
            path.to_path_buf()
        }
    })
}

/// Scan `root` for .md files, build a pruned tree (no empty dirs).
pub fn build_md_tree(root: &Path) -> Vec<FileNode> {
    let mut md_files: Vec<PathBuf> = Vec::new();

    for entry in WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            // skip hidden dirs and node_modules/target
            if e.file_type().is_dir() {
                return !name.starts_with('.')
                    && name != "node_modules"
                    && name != "target";
            }
            true
        })
        .flatten()
    {
        if entry.file_type().is_file() {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                if ext == "md" || ext == "MD" || ext == "markdown" {
                    md_files.push(path.to_path_buf());
                }
            }
        }
    }

    assemble_tree(root, &md_files)
}

/// Build a nested tree structure from flat list of .md file paths.
fn assemble_tree(root: &Path, files: &[PathBuf]) -> Vec<FileNode> {
    // dir_path -> list of children nodes
    let mut dir_children: HashMap<PathBuf, Vec<FileNode>> = HashMap::new();

    // collect all dirs that need to exist
    for file in files {
        let rel = file.strip_prefix(root).unwrap_or(file.as_path());
        let file_name = rel
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let node = FileNode {
            name: file_name,
            path: file.to_string_lossy().to_string(),
            is_dir: false,
            children: None,
        };

        let parent = rel.parent().unwrap_or(Path::new(""));
        dir_children
            .entry(root.join(parent))
            .or_default()
            .push(node);

        // ensure all ancestor dirs exist in the map
        let mut ancestor = parent;
        while ancestor != Path::new("") {
            dir_children.entry(root.join(ancestor)).or_default();
            ancestor = ancestor.parent().unwrap_or(Path::new(""));
        }
    }

    fn build_level(dir: &Path, dir_children: &HashMap<PathBuf, Vec<FileNode>>) -> Vec<FileNode> {
        let mut result: Vec<FileNode> = Vec::new();

        // add files in this dir
        if let Some(nodes) = dir_children.get(dir) {
            for node in nodes {
                if !node.is_dir {
                    result.push(node.clone());
                }
            }
        }

        // add subdirs that have content
        for path in dir_children.keys() {
            if path.parent() == Some(dir) && path != dir {
                let children = build_level(path, dir_children);
                if !children.is_empty() {
                    let name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    result.push(FileNode {
                        name,
                        path: path.to_string_lossy().to_string(),
                        is_dir: true,
                        children: Some(children),
                    });
                }
            }
        }

        // sort: dirs first, then alphabetical
        result.sort_by(|a, b| {
            b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });

        result
    }

    build_level(root, &dir_children)
}
