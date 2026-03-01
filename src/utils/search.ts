export interface SearchMatch {
  start: number;
  end: number;
  line: number;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  regex?: boolean;
}

/**
 * Find all matches of a query in text.
 * Returns match positions and line numbers.
 */
export function findMatches(
  text: string,
  query: string,
  options: SearchOptions = {}
): SearchMatch[] {
  if (!query) return [];

  const { caseSensitive = false, regex = false } = options;
  const matches: SearchMatch[] = [];

  let re: RegExp;
  try {
    if (regex) {
      re = new RegExp(query, caseSensitive ? "g" : "gi");
    } else {
      const escaped = escapeRegex(query);
      re = new RegExp(escaped, caseSensitive ? "g" : "gi");
    }
  } catch {
    // Invalid regex
    return [];
  }

  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const line = countLines(text, start);
    matches.push({ start, end, line });

    // Prevent infinite loop on zero-length matches
    if (match[0].length === 0) {
      re.lastIndex++;
    }
  }

  return matches;
}

/**
 * Count which line number a position is on (1-indexed).
 */
function countLines(text: string, position: number): number {
  let line = 1;
  for (let i = 0; i < position && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

/**
 * Escape special regex characters in a string.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight matches in a DOM container by wrapping them with <mark> elements.
 * Returns the total number of matches found.
 */
export function highlightDom(
  container: HTMLElement,
  query: string,
  caseSensitive: boolean,
  currentIndex: number
): number {
  if (!query) return 0;

  let re: RegExp;
  try {
    re = new RegExp(escapeRegex(query), caseSensitive ? "g" : "gi");
  } catch {
    return 0;
  }

  // Collect text nodes first (walker gets confused if we mutate during walk)
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  let matchCount = 0;

  for (const textNode of textNodes) {
    if (textNode.parentElement?.closest("svg")) continue;

    const text = textNode.textContent || "";
    const nodeMatches: { index: number; length: number }[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;

    while ((m = re.exec(text)) !== null) {
      nodeMatches.push({ index: m.index, length: m[0].length });
      if (m[0].length === 0) re.lastIndex++;
    }

    if (nodeMatches.length === 0) continue;

    const parent = textNode.parentNode;
    if (!parent) continue;

    const frag = document.createDocumentFragment();
    let lastIdx = 0;

    for (const nm of nodeMatches) {
      if (nm.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, nm.index)));
      }
      const mark = document.createElement("mark");
      mark.className =
        matchCount === currentIndex ? "search-highlight current" : "search-highlight";
      mark.textContent = text.slice(nm.index, nm.index + nm.length);
      frag.appendChild(mark);
      matchCount++;
      lastIdx = nm.index + nm.length;
    }

    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }

    parent.replaceChild(frag, textNode);
  }

  return matchCount;
}

/**
 * Remove all <mark> search highlights and restore original text nodes.
 */
export function clearHighlightDom(container: HTMLElement): void {
  const marks = container.querySelectorAll("mark.search-highlight");
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    }
  });
}
