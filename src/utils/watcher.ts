import { watch } from "@tauri-apps/plugin-fs";

type WatchCallback = () => void;

let currentPath: string | null = null;
let stopFn: (() => void) | null = null;

export async function startWatching(path: string, onChange: WatchCallback) {
  await stopWatching();
  currentPath = path;

  const unwatchFn = await watch(path, (event) => {
    // Any modification event triggers reload
    if (event.type && typeof event.type === "object" && "modify" in event.type) {
      onChange();
    }
  });

  stopFn = () => {
    unwatchFn();
  };
}

export async function stopWatching() {
  if (stopFn) {
    stopFn();
    stopFn = null;
  }
  currentPath = null;
}

export function getWatchedPath(): string | null {
  return currentPath;
}
