import { open } from "@tauri-apps/plugin-dialog";
import { getContext, getFileTree, readFile, saveFile, getOpenedFile, setCurrentRoot } from "./ipc";
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
  await setCurrentRoot(ctx.root);

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
  const name = path.split("/").pop() || "mdcat";
  document.title = `${name} — mdcat`;
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

// --- Zoom ---

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
let zoom = 1.0;
let zoomToastTimer = 0;

const zoomToast = document.createElement("div");
zoomToast.className = "zoom-toast";
document.body.appendChild(zoomToast);

function showZoomToast() {
  const pct = Math.round(zoom * 100);
  zoomToast.textContent = `${pct}%`;
  zoomToast.classList.add("visible");
  clearTimeout(zoomToastTimer);
  zoomToastTimer = window.setTimeout(() => zoomToast.classList.remove("visible"), 1200);
}

function applyZoom() {
  document.documentElement.style.fontSize = `${zoom * 14}px`;
  showZoomToast();
}

function zoomIn() {
  zoom = Math.min(ZOOM_MAX, +(zoom + ZOOM_STEP).toFixed(2));
  applyZoom();
}

function zoomOut() {
  zoom = Math.max(ZOOM_MIN, +(zoom - ZOOM_STEP).toFixed(2));
  applyZoom();
}

function zoomReset() {
  zoom = 1.0;
  applyZoom();
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

  if (meta && (e.key === "=" || e.key === "+")) {
    e.preventDefault();
    zoomIn();
  }

  if (meta && e.key === "-") {
    e.preventDefault();
    zoomOut();
  }

  if (meta && e.key === "0") {
    e.preventDefault();
    zoomReset();
  }
});

// --- CLI arg / "Open With" ---

// Poll for pending files (macOS "Open With")
setInterval(async () => {
  try {
    const pending = await getOpenedFile();
    if (pending) {
      console.log("[mdcat] opening pending file:", pending);
      await openFile(pending);
    }
  } catch (err) {
    console.error("[mdcat] polling error:", err);
  }
}, 500);
