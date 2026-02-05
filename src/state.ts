import { AppState, ViewMode, FileContext, FileNode, SearchState } from "./types";

type Listener = (state: AppState) => void;

const listeners: Set<Listener> = new Set();

const state: AppState = {
  filePath: null,
  content: "",
  mode: "preview",
  context: null,
  tree: [],
  dirty: false,
  search: {
    query: "",
    open: false,
    caseSensitive: false,
    currentIndex: 0,
    totalMatches: 0,
  },
};

function notify() {
  for (const fn of listeners) fn(state);
}

export function getState(): Readonly<AppState> {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setFile(path: string, content: string) {
  state.filePath = path;
  state.content = content;
  state.dirty = false;
  notify();
}

export function setContent(content: string) {
  state.content = content;
  state.dirty = true;
  notify();
}

export function markClean() {
  state.dirty = false;
  notify();
}

export function setMode(mode: ViewMode) {
  state.mode = mode;
  notify();
}

export function toggleMode() {
  state.mode = state.mode === "preview" ? "raw" : "preview";
  notify();
}

export function setContext(ctx: FileContext) {
  state.context = ctx;
  notify();
}

export function setTree(tree: FileNode[]) {
  state.tree = tree;
  notify();
}

export function setSearch(updates: Partial<SearchState>) {
  Object.assign(state.search, updates);
  notify();
}

export function toggleSearch() {
  state.search.open = !state.search.open;
  if (!state.search.open) {
    state.search.query = "";
    state.search.currentIndex = 0;
    state.search.totalMatches = 0;
  }
  notify();
}

export function closeSearch() {
  state.search.open = false;
  state.search.query = "";
  state.search.currentIndex = 0;
  state.search.totalMatches = 0;
  notify();
}

export function clearFile() {
  state.filePath = null;
  state.content = "";
  state.dirty = false;
  notify();
}
