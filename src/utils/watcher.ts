import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { watchFile, unwatchFile } from "../ipc";

type WatchCallback = () => void;

let currentPath: string | null = null;
let unlisten: UnlistenFn | null = null;

export async function startWatching(path: string, onChange: WatchCallback) {
  await stopWatching();
  currentPath = path;

  // Listen for file-changed events from Rust backend
  unlisten = await listen("file-changed", () => {
    onChange();
  });

  // Start Rust-side file watcher
  await watchFile(path);
}

export async function stopWatching() {
  if (unlisten) {
    unlisten();
    unlisten = null;
  }
  if (currentPath) {
    await unwatchFile();
  }
  currentPath = null;
}

export function getWatchedPath(): string | null {
  return currentPath;
}
