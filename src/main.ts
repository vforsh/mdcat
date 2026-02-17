import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getContext, getFileTree, readFile, saveFile, getOpenedFile, setCurrentRoot, dumpStateToFile, benchReady } from "./ipc";
import { getState, setFile, setContext, setTree, markClean, toggleSearch } from "./state";
import { syncToggleMode } from "./utils/scroll-sync";
import { FileNode } from "./types";
import { createLayout } from "./components/layout";
import { renameActiveFile } from "./components/file-tree";
import { startWatching } from "./utils/watcher";
import { exposeMdcatAPI } from "./utils/state-bridge";

const app = document.getElementById("app")!;

createLayout(app, openFile);
exposeMdcatAPI();

// --- File operations ---

async function openFile(path: string) {
  // Phase 1: Load content + context in parallel (critical path)
  const [content, ctx] = await Promise.all([readFile(path), getContext(path)]);

  // Render preview immediately
  setFile(path, content);
  setContext(ctx);

  // Update window title early
  const name = path.split("/").pop() || "mdcat";
  const title = `mdcat - ${name}`;
  document.title = title;
  getCurrentWindow().setTitle(title);

  // Release benchmark hook: signal "first paint" after giving the browser a chance to paint
  // the markdown content. No-op unless MDCAT_BENCH_SENTINEL is set.
  scheduleBenchFirstPaint();

  // Phase 2: Defer non-critical work (tree, watcher, root registration)
  (async () => {
    await setCurrentRoot(ctx.root);
    const tree = await getFileTree(ctx.root);
    setTree(tree);

    // Watch for external changes
    await startWatching(path, async () => {
      const state = getState();
      if (state.dirty) return;
      const fresh = await readFile(path);
      setFile(path, fresh);
    });
  })().catch((err) => console.error("[openFile] phase 2 failed:", err));
}

let benchFirstPaintScheduled = false;
function scheduleBenchFirstPaint() {
  if (benchFirstPaintScheduled) return;
  benchFirstPaintScheduled = true;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      benchReady().catch((err) => console.error("[benchReady] failed:", err));
    });
  });
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

// --- State dump ---

function countFiles(nodes: FileNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.is_dir && n.children) count += countFiles(n.children);
    else count++;
  }
  return count;
}

async function handleStateDump() {
  const state = getState();
  const snapshot = {
    filePath: state.filePath,
    mode: state.mode,
    dirty: state.dirty,
    contentLength: state.content.length,
    treeFileCount: countFiles(state.tree),
    search: {
      open: state.search.open,
      query: state.search.query,
      totalMatches: state.search.totalMatches,
    },
    context: state.context ? { root: state.context.root, is_git: state.context.is_git } : null,
    timestamp: new Date().toISOString(),
  };
  await dumpStateToFile(JSON.stringify(snapshot, null, 2));
}

// --- Keyboard shortcuts ---

document.addEventListener("keydown", (e) => {
  const meta = e.metaKey || e.ctrlKey;

  if (meta && e.key === "e") {
    e.preventDefault();
    syncToggleMode();
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

  if (meta && e.key === "f") {
    e.preventDefault();
    toggleSearch();
  }

  if (meta && e.shiftKey && e.key === "d") {
    e.preventDefault();
    handleStateDump();
  }

  if (e.key === "F2") {
    e.preventDefault();
    renameActiveFile();
  }
});

// --- CLI arg / "Open With" ---

// Listen for file-open events from Rust (instant, no polling)
listen<string>("open-file", (event) => {
  console.log("[mdcat] open-file event:", event.payload);
  openFile(event.payload);
});

// Check for initial file (CLI arg or queued before listener ready)
getOpenedFile().then((pending) => {
  if (pending) {
    console.log("[mdcat] initial file:", pending);
    openFile(pending);
  }
});
