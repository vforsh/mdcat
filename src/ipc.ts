import { invoke } from "@tauri-apps/api/core";
import { FileContext, FileNode } from "./types";

export function getContext(path: string): Promise<FileContext> {
  return invoke("get_context", { path });
}

export function getFileTree(root: string): Promise<FileNode[]> {
  return invoke("get_file_tree", { root });
}

export function readFile(path: string): Promise<string> {
  return invoke("read_file", { path });
}

export function saveFile(path: string, content: string): Promise<void> {
  return invoke("save_file", { path, content });
}

export function getOpenedFile(): Promise<string | null> {
  return invoke("get_opened_file");
}

export function setCurrentRoot(root: string): Promise<void> {
  return invoke("set_current_root", { root });
}

export function createFile(path: string): Promise<void> {
  return invoke("create_file", { path });
}

export function renameFile(oldPath: string, newPath: string): Promise<void> {
  return invoke("rename_file", { oldPath, newPath });
}

export function deleteFile(path: string): Promise<void> {
  return invoke("delete_file", { path });
}

export function watchFile(path: string): Promise<void> {
  return invoke("watch_file", { path });
}

export function unwatchFile(): Promise<void> {
  return invoke("unwatch_file");
}

export function dumpStateToFile(stateJson: string): Promise<void> {
  return invoke("dump_state_to_file", { stateJson });
}
