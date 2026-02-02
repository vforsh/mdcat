import { FileNode } from "../types";
import { getState, subscribe } from "../state";

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

  const icon = document.createElement("span");
  icon.className = "icon";
  icon.textContent = "▸";
  item.appendChild(icon);

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
    icon.textContent = collapsed ? "▸" : "▾";
  });

  // Start expanded
  icon.textContent = "▾";
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

  const icon = document.createElement("span");
  icon.className = "icon";
  icon.textContent = "📄";
  item.appendChild(icon);

  const label = document.createElement("span");
  label.textContent = node.name;
  item.appendChild(label);

  item.addEventListener("click", () => {
    if (onSelect) onSelect(node.path);
  });

  parent.appendChild(item);
}
