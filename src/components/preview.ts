import { getState, subscribe } from "../state";
import { renderMarkdown } from "../utils/markdown";
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
