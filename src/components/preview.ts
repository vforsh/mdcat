import { getState, subscribe, toggleMode } from "../state";
import { renderMarkdown } from "../utils/markdown";
import { goToLine } from "./editor";
import "github-markdown-css/github-markdown-light.css";
import "highlight.js/styles/github.css";

let container: HTMLElement;
let wrap: HTMLElement;

export function createPreview(): HTMLElement {
  container = document.createElement("div");
  container.style.display = "block";
  container.style.height = "100%";
  container.style.overflow = "auto";

  wrap = document.createElement("div");
  wrap.className = "preview-wrap markdown-body";
  container.appendChild(wrap);

  container.addEventListener("dblclick", (e) => {
    if (getState().mode !== "preview") return;

    // Find closest element with data-source-line
    const target = e.target as HTMLElement;
    const lineEl = target.closest("[data-source-line]") as HTMLElement | null;
    const line = lineEl ? parseInt(lineEl.dataset.sourceLine || "1", 10) : 1;

    toggleMode();
    // Wait for editor to render, then jump to line
    requestAnimationFrame(() => goToLine(line));
  });

  subscribe(render);
  render(getState());

  return container;
}

function render(state: ReturnType<typeof getState>) {
  container.style.display = state.mode === "preview" ? "block" : "none";

  if (state.mode !== "preview") return;

  if (!state.filePath) {
    wrap.innerHTML = "";
    return;
  }

  wrap.innerHTML = renderMarkdown(state.content);
}
