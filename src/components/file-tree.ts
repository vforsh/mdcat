import { FileNode } from "../types";
import { getState, subscribe } from "../state";
import * as icons from "../utils/icons";

let container: HTMLElement;
let onSelect: ((path: string) => void) | null = null;

export function createFileTree(selectHandler: (path: string) => void): HTMLElement {
  onSelect = selectHandler;

  container = document.createElement("div");
  container.className = "sidebar";

  subscribe(render);
  render(getState());

  return container;
}

function render(state: ReturnType<typeof getState>) {
  container.innerHTML = "";
  if (state.tree.length === 0) return;
  renderNodes(state.tree, container, 0, state.filePath);
}

function renderNodes(
  nodes: FileNode[],
  parent: HTMLElement,
  depth: number,
  activePath: string | null,
) {
  for (const node of nodes) {
    if (node.is_dir) {
      renderDir(node, parent, depth, activePath);
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
) {
  const item = document.createElement("div");
  item.className = "tree-item";
  item.style.paddingLeft = `${8 + depth * 16}px`;

  const chevron = document.createElement("span");
  chevron.className = "icon chevron";
  chevron.appendChild(icons.chevronDown(14));
  item.appendChild(chevron);

  const folderIcon = document.createElement("span");
  folderIcon.className = "icon";
  folderIcon.appendChild(icons.folderOpen());
  item.appendChild(folderIcon);

  const label = document.createElement("span");
  label.textContent = node.name;
  item.appendChild(label);

  parent.appendChild(item);

  const childWrap = document.createElement("div");
  childWrap.className = "tree-dir-children";
  parent.appendChild(childWrap);

  if (node.children) {
    renderNodes(node.children, childWrap, depth + 1, activePath);
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
