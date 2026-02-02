import { getCurrentWindow } from "@tauri-apps/api/window";
import { getState, subscribe, toggleMode } from "../state";

let filenameEl: HTMLElement;
let dirtyDot: HTMLElement;
let previewBtn: HTMLButtonElement;
let rawBtn: HTMLButtonElement;

export function createToolbar(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "toolbar";

  // Left spacer (mirrors toggle width for centering)
  const leftSpacer = document.createElement("div");
  leftSpacer.className = "toolbar-spacer";
  bar.appendChild(leftSpacer);

  // Filename (centered)
  const nameWrap = document.createElement("div");
  nameWrap.className = "toolbar-filename";

  filenameEl = document.createElement("span");
  filenameEl.textContent = "mdcat";
  nameWrap.appendChild(filenameEl);

  dirtyDot = document.createElement("span");
  dirtyDot.className = "dirty-indicator";
  dirtyDot.textContent = "[edited]";
  nameWrap.appendChild(dirtyDot);

  bar.appendChild(nameWrap);

  // Mode toggle
  const toggleWrap = document.createElement("div");
  toggleWrap.className = "mode-toggle";
  toggleWrap.title = "Toggle editor (⌘E)";

  previewBtn = document.createElement("button");
  previewBtn.className = "mode-toggle-btn active";
  previewBtn.textContent = "Preview";
  previewBtn.addEventListener("click", () => { if (getState().mode !== "preview") toggleMode(); });

  rawBtn = document.createElement("button");
  rawBtn.className = "mode-toggle-btn";
  rawBtn.textContent = "Edit";
  rawBtn.addEventListener("click", () => { if (getState().mode !== "raw") toggleMode(); });

  toggleWrap.append(previewBtn, rawBtn);

  const rightSpacer = document.createElement("div");
  rightSpacer.className = "toolbar-spacer toolbar-spacer-right";
  rightSpacer.appendChild(toggleWrap);
  bar.appendChild(rightSpacer);

  // Window dragging (decorations: false requires explicit startDragging in Tauri v2)
  bar.addEventListener("mousedown", (e) => {
    if (e.buttons === 1 && !(e.target as HTMLElement).closest("button, input, select, a")) {
      getCurrentWindow().startDragging();
    }
  });

  subscribe(render);
  render(getState());

  return bar;
}

function render(state: ReturnType<typeof getState>) {
  if (state.filePath) {
    const name = state.filePath.split("/").pop() || state.filePath;
    filenameEl.textContent = name;
  } else {
    filenameEl.textContent = "mdcat";
  }

  dirtyDot.classList.toggle("visible", state.dirty);

  const isPreview = state.mode === "preview";
  previewBtn.classList.toggle("active", isPreview);
  rawBtn.classList.toggle("active", !isPreview);
}
