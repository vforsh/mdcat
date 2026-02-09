import { getState, toggleMode, setMode, toggleSearch, closeSearch, setSearch } from "../state";
import { ViewMode } from "../types";

interface MdcatAPI {
  getState(): ReturnType<typeof getState>;
  toggleMode(): void;
  setMode(mode: ViewMode): void;
  openSearch(): void;
  closeSearch(): void;
  setSearchQuery(query: string): void;
}

declare global {
  interface Window {
    __mdcat?: MdcatAPI;
  }
}

export function exposeMdcatAPI() {
  // @ts-expect-error Vite injects import.meta.env at build time
  if (!import.meta.env.DEV) return;

  window.__mdcat = {
    getState() {
      return getState();
    },
    toggleMode() {
      toggleMode();
    },
    setMode(mode: ViewMode) {
      setMode(mode);
    },
    openSearch() {
      if (!getState().search.open) toggleSearch();
    },
    closeSearch() {
      closeSearch();
    },
    setSearchQuery(query: string) {
      if (!getState().search.open) toggleSearch();
      setSearch({ query });
    },
  };
}
