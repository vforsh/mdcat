import { FileNode } from "../types";
import { getState, subscribe } from "../state";
import * as icons from "../utils/icons";

let container: HTMLElement;
let header: HTMLElement;
let treeWrap: HTMLElement;
let onSelect: ((path: string) => void) | null = null;

export function createFileTree(selectHandler: (path: string) => void): HTMLElement {
  onSelect = selectHandler;

  container = document.createElement("div");
  container.className = "sidebar";

  header = document.createElement("div");
  header.className = "sidebar-header";
  container.appendChild(header);

  treeWrap = document.createElement("div");
  treeWrap.className = "sidebar-tree";
  container.appendChild(treeWrap);

  subscribe(render);
  render(getState());

  return container;
}

function render(state: ReturnType<typeof getState>) {
  const dirName = state.context?.root.split("/").pop() ?? "";
  header.textContent = dirName;
  header.style.display = dirName ? "block" : "none";

  treeWrap.innerHTML = "";
  if (state.tree.length === 0) return;

  const expandedDirs = collectAncestorDirs(state.tree, state.filePath);
  renderNodes(state.tree, treeWrap, 0, state.filePath, expandedDirs);
}

/** Collect paths of all directories that are ancestors of `targetPath`. */
function collectAncestorDirs(nodes: FileNode[], targetPath: string | null): Set<string> {
  const result = new Set<string>();
  if (!targetPath) return result;

  function walk(nodes: FileNode[], ancestors: string[]): boolean {
    for (const node of nodes) {
      if (node.is_dir && node.children) {
        const found = walk(node.children, [...ancestors, node.path]);
        if (found) {
          result.add(node.path);
          for (const a of ancestors) result.add(a);
          return true;
        }
      } else if (node.path === targetPath) {
        for (const a of ancestors) result.add(a);
        return true;
      }
    }
    return false;
  }

  walk(nodes, []);
  return result;
}

function renderNodes(
  nodes: FileNode[],
  parent: HTMLElement,
  depth: number,
  activePath: string | null,
  expandedDirs: Set<string>,
) {
  for (const node of nodes) {
    if (node.is_dir) {
      renderDir(node, parent, depth, activePath, expandedDirs);
    } else {
      renderFile(node, parent, depth, activePath);
    }
  }
}

function renderDir(
  node: FileNode,
  parent: HTMLElement,
  depth: number,
  activePath: string | null,
  expandedDirs: Set<string>,
) {
  const expanded = expandedDirs.has(node.path);

  const item = document.createElement("div");
  item.className = "tree-item";
  item.style.paddingLeft = `${8 + depth * 16}px`;

  const chevron = document.createElement("span");
  chevron.className = "icon chevron";
  chevron.appendChild(expanded ? icons.chevronDown(14) : icons.chevronRight(14));
  item.appendChild(chevron);

  const folderIcon = document.createElement("span");
  folderIcon.className = "icon";
  folderIcon.appendChild(expanded ? icons.folderOpen() : icons.folder());
  item.appendChild(folderIcon);

  const label = document.createElement("span");
  label.textContent = node.name;
  item.appendChild(label);

  parent.appendChild(item);

  const childWrap = document.createElement("div");
  childWrap.className = `tree-dir-children${expanded ? "" : " collapsed"}`;
  parent.appendChild(childWrap);

  if (node.children) {
    renderNodes(node.children, childWrap, depth + 1, activePath, expandedDirs);
  }

  item.addEventListener("click", () => {
    const collapsed = childWrap.classList.toggle("collapsed");
    chevron.innerHTML = "";
    chevron.appendChild(collapsed ? icons.chevronRight(14) : icons.chevronDown(14));
    folderIcon.innerHTML = "";
    folderIcon.appendChild(collapsed ? icons.folder() : icons.folderOpen());
  });
}

function renderFile(
  node: FileNode,
  parent: HTMLElement,
  depth: number,
  activePath: string | null,
) {
  const item = document.createElement("div");
  item.className = "tree-item";
  if (node.path === activePath) item.classList.add("active");
  item.style.paddingLeft = `${8 + depth * 16}px`;

  // spacer to align with folder names (chevron width)
  const spacer = document.createElement("span");
  spacer.className = "icon chevron";
  item.appendChild(spacer);

  const fileIcon = document.createElement("span");
  fileIcon.className = "icon";
  fileIcon.appendChild(icons.fileText());
  item.appendChild(fileIcon);

  const label = document.createElement("span");
  label.textContent = node.name;
  item.appendChild(label);

  item.addEventListener("click", () => {
    if (onSelect) onSelect(node.path);
  });

  parent.appendChild(item);
}
