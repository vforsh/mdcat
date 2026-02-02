import { getState, subscribe, toggleMode } from "../state";

let filenameEl: HTMLElement;
let dirtyDot: HTMLElement;
let modeBtn: HTMLButtonElement;

export function createToolbar(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "toolbar";

  // Filename
  const nameWrap = document.createElement("div");
  nameWrap.className = "toolbar-filename";

  dirtyDot = document.createElement("span");
  dirtyDot.className = "dirty-dot";
  nameWrap.appendChild(dirtyDot);

  filenameEl = document.createElement("span");
  filenameEl.textContent = "mdash";
  nameWrap.appendChild(filenameEl);

  bar.appendChild(nameWrap);

  // Mode toggle
  modeBtn = document.createElement("button");
  modeBtn.className = "toolbar-btn";
  modeBtn.textContent = "Raw";
  modeBtn.title = "Toggle editor (⌘E)";
  modeBtn.addEventListener("click", toggleMode);
  bar.appendChild(modeBtn);

  subscribe(render);
  render(getState());

  return bar;
}

function render(state: ReturnType<typeof getState>) {
  if (state.filePath) {
    const name = state.filePath.split("/").pop() || state.filePath;
    filenameEl.textContent = name;
  } else {
    filenameEl.textContent = "mdash";
  }

  dirtyDot.classList.toggle("visible", state.dirty);

  if (state.mode === "raw") {
    modeBtn.textContent = "Preview";
    modeBtn.classList.add("active");
  } else {
    modeBtn.textContent = "Raw";
    modeBtn.classList.remove("active");
  }
}
