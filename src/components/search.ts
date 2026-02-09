import { getState, subscribe, setSearch, closeSearch } from "../state";
import { findMatches, SearchMatch } from "../utils/search";
import { iconChevronUp, iconChevronDown, iconX } from "../utils/icons";

let container: HTMLElement;
let input: HTMLInputElement;
let matches: SearchMatch[] = [];
let onNavigate: ((line: number) => void) | null = null;

export function createSearchPanel(navigateFn: (line: number) => void): HTMLElement {
  onNavigate = navigateFn;

  container = document.createElement("div");
  container.className = "search-panel";
  container.setAttribute("role", "search");
  container.dataset.testid = "search-panel";

  input = document.createElement("input");
  input.type = "text";
  input.className = "search-input";
  input.placeholder = "Search...";
  input.setAttribute("aria-label", "Search in document");
  input.dataset.testid = "search-input";
  input.addEventListener("input", handleInput);
  input.addEventListener("keydown", handleKeydown);
  container.appendChild(input);

  const counter = document.createElement("span");
  counter.className = "search-counter";
  counter.dataset.testid = "search-counter";
  container.appendChild(counter);

  const caseBtn = document.createElement("button");
  caseBtn.className = "search-btn search-case-btn";
  caseBtn.textContent = "Aa";
  caseBtn.title = "Match case";
  caseBtn.setAttribute("aria-label", "Toggle case sensitivity");
  caseBtn.dataset.testid = "search-case-btn";
  caseBtn.addEventListener("click", () => {
    setSearch({ caseSensitive: !getState().search.caseSensitive });
    updateMatches();
  });
  container.appendChild(caseBtn);

  const prevBtn = document.createElement("button");
  prevBtn.className = "search-btn";
  prevBtn.title = "Previous (Shift+Enter)";
  prevBtn.setAttribute("aria-label", "Previous match");
  prevBtn.dataset.testid = "search-prev-btn";
  prevBtn.appendChild(iconChevronUp());
  prevBtn.addEventListener("click", goToPrev);
  container.appendChild(prevBtn);

  const nextBtn = document.createElement("button");
  nextBtn.className = "search-btn";
  nextBtn.title = "Next (Enter)";
  nextBtn.setAttribute("aria-label", "Next match");
  nextBtn.dataset.testid = "search-next-btn";
  nextBtn.appendChild(iconChevronDown());
  nextBtn.addEventListener("click", goToNext);
  container.appendChild(nextBtn);

  const closeBtn = document.createElement("button");
  closeBtn.className = "search-btn";
  closeBtn.title = "Close (Escape)";
  closeBtn.setAttribute("aria-label", "Close search");
  closeBtn.dataset.testid = "search-close-btn";
  closeBtn.appendChild(iconX());
  closeBtn.addEventListener("click", closeSearch);
  container.appendChild(closeBtn);

  subscribe(render);
  render(getState());

  return container;
}

function render(state: ReturnType<typeof getState>) {
  container.style.display = state.search.open ? "flex" : "none";

  if (state.search.open && document.activeElement !== input) {
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  const counter = container.querySelector(".search-counter") as HTMLElement;
  if (state.search.totalMatches > 0) {
    counter.textContent = `${state.search.currentIndex + 1} of ${state.search.totalMatches}`;
  } else if (state.search.query) {
    counter.textContent = "0 of 0";
  } else {
    counter.textContent = "\u00A0";
  }

  const caseBtn = container.querySelector(".search-case-btn") as HTMLElement;
  caseBtn.classList.toggle("active", state.search.caseSensitive);
}

function handleInput() {
  setSearch({ query: input.value });
  updateMatches();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeSearch();
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (e.shiftKey) {
      goToPrev();
    } else {
      goToNext();
    }
  }
}

function updateMatches() {
  const state = getState();
  matches = findMatches(state.content, state.search.query, {
    caseSensitive: state.search.caseSensitive,
  });

  let currentIndex = 0;
  if (matches.length > 0 && state.search.currentIndex >= matches.length) {
    currentIndex = 0;
  } else {
    currentIndex = state.search.currentIndex;
  }

  setSearch({ totalMatches: matches.length, currentIndex });

  if (matches.length > 0 && onNavigate) {
    onNavigate(matches[currentIndex].line);
  }
}

function goToNext() {
  const state = getState();
  if (matches.length === 0) return;

  const nextIndex = (state.search.currentIndex + 1) % matches.length;
  setSearch({ currentIndex: nextIndex });

  if (onNavigate) {
    onNavigate(matches[nextIndex].line);
  }
}

function goToPrev() {
  const state = getState();
  if (matches.length === 0) return;

  const prevIndex = (state.search.currentIndex - 1 + matches.length) % matches.length;
  setSearch({ currentIndex: prevIndex });

  if (onNavigate) {
    onNavigate(matches[prevIndex].line);
  }
}

export function getSearchMatches(): SearchMatch[] {
  return matches;
}

export function focusSearchInput() {
  if (input) {
    input.focus();
    input.select();
  }
}
