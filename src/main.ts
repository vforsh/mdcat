import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { getContext, getFileTree, readFile, saveFile, getOpenedFile } from "./ipc";
import { getState, setFile, setContext, setTree, toggleMode, markClean } from "./state";
import { createLayout } from "./components/layout";
import { startWatching } from "./utils/watcher";

const app = document.getElementById("app")!;

createLayout(app, openFile);

// --- File operations ---

async function openFile(path: string) {
  const content = await readFile(path);
  setFile(path, content);

  const ctx = await getContext(path);
  setContext(ctx);

  const tree = await getFileTree(ctx.root);
  setTree(tree);

  // Watch for external changes
  await startWatching(path, async () => {
    const state = getState();
    // Don't reload if user has unsaved edits
    if (state.dirty) return;
    const fresh = await readFile(path);
    setFile(path, fresh);
  });

  // Update window title
  const name = path.split("/").pop() || "mdash";
  document.title = `${name} — mdash`;
}

async function handleSave() {
  const state = getState();
  if (!state.filePath || !state.dirty) return;
  await saveFile(state.filePath, state.content);
  markClean();
}

async function handleOpen() {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdown", "mkd"] }],
  });
  if (selected) {
    await openFile(selected as string);
  }
}

// --- Keyboard shortcuts ---

document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;

  if (meta && e.key === "e") {
    e.preventDefault();
    toggleMode();
  }

  if (meta && e.key === "s") {
    e.preventDefault();
    handleSave();
  }

  if (meta && e.key === "o") {
    e.preventDefault();
    handleOpen();
  }
});

// --- CLI arg / "Open With" ---

async function init() {
  // Check if a file was passed via CLI or "Open With"
  const opened = await getOpenedFile();
  if (opened) {
    await openFile(opened);
  }

  // Listen for macOS "Open With" events arriving after launch
  await listen<string>("open-file", async (event) => {
    await openFile(event.payload);
  });
}

init();
