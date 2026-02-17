import { openUrl } from "@tauri-apps/plugin-opener";
import { getState, subscribe, toggleMode } from "../state";
import { SearchState } from "../types";
import { renderMarkdown } from "../utils/markdown";
import { highlightDom, clearHighlightDom } from "../utils/search";
import { goToLine } from "./editor";
import "github-markdown-css/github-markdown-light.css";
import "highlight.js/styles/github.css";

let container: HTMLElement;
let wrap: HTMLElement;
let lastContent = "";
let lastSearch = { open: false, query: "", index: -1, caseSensitive: false };

export function createPreview(): HTMLElement {
  container = document.createElement("div");
  container.style.display = "block";
  container.style.height = "100%";
  container.style.overflow = "auto";
  container.dataset.testid = "preview-container";

  wrap = document.createElement("div");
  wrap.className = "preview-wrap markdown-body";
  wrap.dataset.testid = "preview-content";
  container.appendChild(wrap);

  container.addEventListener("click", (e) => {
    const anchor = (e.target as HTMLElement).closest("a[href]") as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    e.preventDefault();
    openUrl(href);
  });

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
    lastContent = "";
    return;
  }

  // Only re-render markdown when content or file changes
  if (state.content !== lastContent) {
    const baseDir = state.filePath ? state.filePath.replace(/\/[^/]+$/, "") : null;
    wrap.innerHTML = renderMarkdown(state.content, baseDir);
    lastContent = state.content;
    // Force highlight refresh after re-render
    lastSearch = { open: false, query: "", index: -1, caseSensitive: false };
  }

  applySearchHighlights(state.search);
}

export function getPreviewVisibleLine(): number {
  const scrollTop = container.scrollTop;
  const els = container.querySelectorAll("[data-source-line]");
  for (const el of els) {
    if ((el as HTMLElement).offsetTop >= scrollTop) {
      return parseInt((el as HTMLElement).dataset.sourceLine || "1", 10);
    }
  }
  return 1;
}

function applySearchHighlights(search: SearchState) {
  const changed =
    search.open !== lastSearch.open ||
    search.query !== lastSearch.query ||
    search.currentIndex !== lastSearch.index ||
    search.caseSensitive !== lastSearch.caseSensitive;

  if (!changed) return;

  lastSearch = {
    open: search.open,
    query: search.query,
    index: search.currentIndex,
    caseSensitive: search.caseSensitive,
  };

  clearHighlightDom(wrap);

  if (!search.open || !search.query) return;

  highlightDom(wrap, search.query, search.caseSensitive, search.currentIndex);

  // Scroll current match into view
  const current = wrap.querySelector("mark.search-highlight.current");
  if (current) {
    current.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
