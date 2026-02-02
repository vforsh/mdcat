import { getState, subscribe } from "../state";
import { createToolbar } from "./toolbar";
import { createFileTree } from "./file-tree";
import { createPreview } from "./preview";
import { createEditor } from "./editor";

export function createLayout(
  app: HTMLElement,
  onFileSelect: (path: string) => void,
) {
  const toolbar = createToolbar();
  app.appendChild(toolbar);

  const main = document.createElement("div");
  main.className = "main-layout";
  app.appendChild(main);

  const sidebar = createFileTree(onFileSelect);
  main.appendChild(sidebar);

  const handle = document.createElement("div");
  handle.className = "resize-handle";
  main.appendChild(handle);

  initResize(handle, sidebar);

  const contentPane = document.createElement("div");
  contentPane.className = "content-pane";
  main.appendChild(contentPane);

  // Empty state
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.innerHTML = `
    <div>Open a markdown file</div>
    <div><span class="shortcut">⌘O</span> to open &nbsp; <span class="shortcut">⌘E</span> to toggle editor</div>
  `;
  contentPane.appendChild(empty);

  const preview = createPreview();
  contentPane.appendChild(preview);

  const editor = createEditor();
  contentPane.appendChild(editor);

  // Hide empty state when file is loaded
  subscribe((state) => {
    empty.style.display = state.filePath ? "none" : "flex";
  });
  empty.style.display = getState().filePath ? "none" : "flex";
}

function initResize(handle: HTMLElement, sidebar: HTMLElement) {
  let startX = 0;
  let startW = 0;

  function onMouseMove(e: MouseEvent) {
    const newW = Math.max(120, Math.min(startW + e.clientX - startX, window.innerWidth / 2));
    sidebar.style.width = `${newW}px`;
  }

  function onMouseUp() {
    handle.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startW = sidebar.getBoundingClientRect().width;
    handle.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}
