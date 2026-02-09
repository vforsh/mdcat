import { getCurrentWindow } from "@tauri-apps/api/window";
import { FileNode } from "../types";
import { getState, subscribe, clearFile, setTree } from "../state";
import { getFileTree, createFile, renameFile, deleteFile } from "../ipc";
import { showContextMenu, MenuItem } from "./context-menu";
import * as icons from "../utils/icons";

let container: HTMLElement;
let header: HTMLElement;
let treeWrap: HTMLElement;
let onSelect: ((path: string) => void) | null = null;
const manualExpanded = new Set<string>();

export function createFileTree(selectHandler: (path: string) => void): HTMLElement {
  onSelect = selectHandler;

  container = document.createElement("div");
  container.className = "sidebar";

  header = document.createElement("div");
  header.className = "sidebar-header";
  header.dataset.testid = "file-tree-header";
  container.appendChild(header);

  treeWrap = document.createElement("div");
  treeWrap.className = "sidebar-tree";
  treeWrap.setAttribute("role", "tree");
  treeWrap.dataset.testid = "file-tree";
  treeWrap.tabIndex = 0;
  treeWrap.addEventListener("keydown", handleTreeKeydown);
  container.appendChild(treeWrap);

  subscribe(render);
  render(getState());

  return container;
}

function render(state: ReturnType<typeof getState>) {
  const dirName = state.context?.root.split("/").pop() ?? "";

  // Rebuild header with label + "+" button
  header.innerHTML = "";
  header.style.display = dirName ? "flex" : "none";

  const label = document.createElement("span");
  label.className = "sidebar-header-label";
  label.textContent = dirName;
  header.appendChild(label);

  if (dirName) {
    const addBtn = document.createElement("button");
    addBtn.className = "sidebar-header-btn";
    addBtn.title = "New file";
    addBtn.setAttribute("aria-label", "New file");
    addBtn.dataset.testid = "file-tree-add-btn";
    addBtn.appendChild(icons.plus(14));
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const root = state.context?.root;
      if (root) showNewFileInput(treeWrap, root, 0, true);
    });
    header.appendChild(addBtn);
  }

  treeWrap.innerHTML = "";
  if (state.tree.length === 0) return;

  const ancestorDirs = collectAncestorDirs(state.tree, state.filePath);
  for (const dir of ancestorDirs) manualExpanded.add(dir);
  renderNodes(state.tree, treeWrap, 0, state.filePath, manualExpanded);
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

function createCopyBtn(path: string): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "tree-item-copy";
  btn.title = path;
  btn.setAttribute("aria-label", "Copy path");
  btn.appendChild(icons.copy(13));

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    btn.innerHTML = "";
    btn.appendChild(icons.check(13));
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = "";
      btn.appendChild(icons.copy(13));
      btn.classList.remove("copied");
    }, 1500);
  });

  return btn;
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
  item.dataset.path = node.path;
  item.dataset.type = "dir";
  item.setAttribute("role", "treeitem");
  item.setAttribute("aria-expanded", String(expanded));
  item.dataset.testid = `tree-dir-${node.name}`;
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
  label.className = "tree-item-label";
  label.textContent = node.name;
  item.appendChild(label);

  item.appendChild(createCopyBtn(node.path));

  parent.appendChild(item);

  const childWrap = document.createElement("div");
  childWrap.className = `tree-dir-children${expanded ? "" : " collapsed"}`;
  parent.appendChild(childWrap);

  if (node.children) {
    renderNodes(node.children, childWrap, depth + 1, activePath, expandedDirs);
  }

  item.addEventListener("click", () => {
    const collapsed = childWrap.classList.toggle("collapsed");
    if (collapsed) {
      manualExpanded.delete(node.path);
    } else {
      manualExpanded.add(node.path);
    }
    item.setAttribute("aria-expanded", String(!collapsed));
    chevron.innerHTML = "";
    chevron.appendChild(collapsed ? icons.chevronRight(14) : icons.chevronDown(14));
    folderIcon.innerHTML = "";
    folderIcon.appendChild(collapsed ? icons.folder() : icons.folderOpen());
  });

  item.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showDirContextMenu(e.clientX, e.clientY, node, childWrap, depth);
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
  item.dataset.path = node.path;
  item.dataset.type = "file";
  item.setAttribute("role", "treeitem");
  item.dataset.testid = `tree-file-${node.name}`;
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
  label.className = "tree-item-label";
  label.textContent = node.name;
  item.appendChild(label);

  item.appendChild(createCopyBtn(node.path));

  item.addEventListener("click", () => {
    if (onSelect) onSelect(node.path);
  });

  item.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    showFileContextMenu(e.clientX, e.clientY, node, item);
  });

  parent.appendChild(item);
}

// --- Keyboard navigation ---

function getVisibleItems(): HTMLElement[] {
  return Array.from(treeWrap.querySelectorAll<HTMLElement>(".tree-item")).filter((el) => {
    // Exclude items inside collapsed directories
    const parent = el.parentElement;
    if (parent && parent.classList.contains("tree-dir-children") && parent.classList.contains("collapsed")) {
      return false;
    }
    return true;
  });
}

function getFocusedItem(): HTMLElement | null {
  return treeWrap.querySelector<HTMLElement>(".tree-item.focused");
}

function setFocusedItem(item: HTMLElement) {
  getFocusedItem()?.classList.remove("focused");
  item.classList.add("focused");
  item.scrollIntoView({ block: "nearest" });
}

function handleTreeKeydown(e: KeyboardEvent) {
  // Don't handle keys when an input is focused (rename/new file)
  if ((e.target as HTMLElement).tagName === "INPUT") return;

  const items = getVisibleItems();
  if (items.length === 0) return;

  let focused = getFocusedItem();
  let idx = focused ? items.indexOf(focused) : -1;

  switch (e.key) {
    case "ArrowDown": {
      e.preventDefault();
      const next = idx < items.length - 1 ? idx + 1 : 0;
      setFocusedItem(items[next]);
      break;
    }
    case "ArrowUp": {
      e.preventDefault();
      const prev = idx > 0 ? idx - 1 : items.length - 1;
      setFocusedItem(items[prev]);
      break;
    }
    case "ArrowRight": {
      e.preventDefault();
      if (!focused) break;
      if (focused.dataset.type === "dir") {
        const childWrap = focused.nextElementSibling as HTMLElement;
        if (childWrap?.classList.contains("collapsed")) {
          // Expand
          focused.click();
        } else {
          // Already expanded — move into first child
          const updated = getVisibleItems();
          const newIdx = updated.indexOf(focused);
          if (newIdx < updated.length - 1) {
            setFocusedItem(updated[newIdx + 1]);
          }
        }
      }
      break;
    }
    case "ArrowLeft": {
      e.preventDefault();
      if (!focused) break;
      if (focused.dataset.type === "dir") {
        const childWrap = focused.nextElementSibling as HTMLElement;
        if (childWrap && !childWrap.classList.contains("collapsed")) {
          // Collapse
          focused.click();
          break;
        }
      }
      // Move to parent directory
      const parentChildren = focused.parentElement;
      if (parentChildren?.classList.contains("tree-dir-children")) {
        const parentDir = parentChildren.previousElementSibling as HTMLElement;
        if (parentDir?.classList.contains("tree-item")) {
          setFocusedItem(parentDir);
        }
      }
      break;
    }
    case "Enter":
    case " ": {
      e.preventDefault();
      focused?.click();
      break;
    }
    default:
      return; // Don't prevent default for other keys
  }
}

// --- Context menus ---

function showFileContextMenu(x: number, y: number, node: FileNode, item: HTMLElement) {
  const items: MenuItem[] = [
    {
      label: "Rename",
      icon: icons.pencil(14),
      action: () => startRename(node, item),
    },
    {
      label: "Delete",
      icon: icons.trash(14),
      danger: true,
      action: () => handleDelete(node),
    },
  ];
  showContextMenu(x, y, items);
}

function showDirContextMenu(
  x: number, y: number, node: FileNode,
  childWrap: HTMLElement, depth: number,
) {
  const items: MenuItem[] = [
    {
      label: "New File",
      icon: icons.plus(14),
      action: () => {
        // Expand directory if collapsed
        if (childWrap.classList.contains("collapsed")) {
          childWrap.classList.remove("collapsed");
          manualExpanded.add(node.path);
        }
        showNewFileInput(childWrap, node.path, depth + 1, true);
      },
    },
    {
      label: "Rename",
      icon: icons.pencil(14),
      action: () => {
        // For directories, we find the tree-item element
        const dirItem = childWrap.previousElementSibling as HTMLElement;
        if (dirItem) startRename(node, dirItem);
      },
    },
    {
      label: "Delete",
      icon: icons.trash(14),
      danger: true,
      action: () => handleDeleteDir(node),
    },
  ];
  showContextMenu(x, y, items);
}

// --- Inline rename ---

function startRename(node: FileNode, item: HTMLElement) {
  const label = item.querySelector(".tree-item-label") as HTMLElement;
  if (!label) return;

  const input = document.createElement("input");
  input.className = "tree-item-input";
  input.value = node.name;
  input.type = "text";

  label.replaceWith(input);
  input.focus();
  // Select filename without extension
  const dotIdx = node.name.lastIndexOf(".");
  input.setSelectionRange(0, dotIdx > 0 ? dotIdx : node.name.length);

  let committed = false;

  async function commit() {
    if (committed) return;
    committed = true;

    const newName = input.value.trim();
    if (!newName || newName === node.name) {
      // Cancel — restore label
      const restored = document.createElement("span");
      restored.className = "tree-item-label";
      restored.textContent = node.name;
      input.replaceWith(restored);
      return;
    }

    const parentDir = node.path.substring(0, node.path.lastIndexOf("/"));
    const newPath = `${parentDir}/${newName}`;

    try {
      await renameFile(node.path, newPath);
      const state = getState();
      // If we renamed the active file, reopen it at new path
      if (state.filePath === node.path && onSelect) {
        onSelect(newPath);
      }
      await refreshTree();
    } catch (err) {
      console.error("Rename failed:", err);
      const restored = document.createElement("span");
      restored.className = "tree-item-label";
      restored.textContent = node.name;
      input.replaceWith(restored);
    }
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      committed = true; // prevent blur from committing
      const restored = document.createElement("span");
      restored.className = "tree-item-label";
      restored.textContent = node.name;
      input.replaceWith(restored);
    }
  });

  input.addEventListener("blur", () => commit());
}

// --- Inline new file ---

function showNewFileInput(
  parentEl: HTMLElement, dirPath: string, depth: number,
  prepend: boolean,
) {
  const item = document.createElement("div");
  item.className = "tree-item";
  item.style.paddingLeft = `${8 + depth * 16}px`;

  // spacer (chevron width)
  const spacer = document.createElement("span");
  spacer.className = "icon chevron";
  item.appendChild(spacer);

  const fileIcon = document.createElement("span");
  fileIcon.className = "icon";
  fileIcon.appendChild(icons.fileText());
  item.appendChild(fileIcon);

  const input = document.createElement("input");
  input.className = "tree-item-input";
  input.type = "text";
  input.placeholder = "filename.md";
  item.appendChild(input);

  if (prepend && parentEl.firstChild) {
    parentEl.insertBefore(item, parentEl.firstChild);
  } else {
    parentEl.appendChild(item);
  }

  input.focus();

  let committed = false;

  async function commit() {
    if (committed) return;
    committed = true;

    let name = input.value.trim();
    if (!name) {
      item.remove();
      return;
    }

    // Auto-append .md if no extension
    if (!name.includes(".")) {
      name += ".md";
    }

    const fullPath = `${dirPath}/${name}`;

    try {
      await createFile(fullPath);
      await refreshTree();
      if (onSelect) onSelect(fullPath);
    } catch (err) {
      console.error("Create file failed:", err);
      item.remove();
    }
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      committed = true;
      item.remove();
    }
  });

  input.addEventListener("blur", () => commit());
}

// --- Delete ---

async function handleDelete(node: FileNode) {
  try {
    await deleteFile(node.path);
    const state = getState();
    if (state.filePath === node.path) {
      clearFile();
      document.title = "mdcat";
      getCurrentWindow().setTitle("mdcat");
    }
    await refreshTree();
  } catch (err) {
    console.error("Delete failed:", err);
  }
}

async function handleDeleteDir(node: FileNode) {
  // Recursively collect all file paths in this directory
  const files = collectFiles(node);
  if (files.length === 0) return;

  try {
    for (const f of files) {
      await deleteFile(f);
    }
    const state = getState();
    if (state.filePath && files.includes(state.filePath)) {
      clearFile();
      document.title = "mdcat";
      getCurrentWindow().setTitle("mdcat");
    }
    await refreshTree();
  } catch (err) {
    console.error("Delete directory failed:", err);
  }
}

function collectFiles(node: FileNode): string[] {
  if (!node.is_dir) return [node.path];
  const result: string[] = [];
  for (const child of node.children ?? []) {
    result.push(...collectFiles(child));
  }
  return result;
}

// --- Public API ---

/** Trigger inline rename on the currently active file (F2 shortcut). */
export function renameActiveFile() {
  const state = getState();
  if (!state.filePath) return;

  const activeItem = treeWrap.querySelector(".tree-item.active") as HTMLElement;
  if (!activeItem) return;

  // Find the matching FileNode
  const node = findNode(state.tree, state.filePath);
  if (node) startRename(node, activeItem);
}

function findNode(nodes: FileNode[], path: string): FileNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    if (n.is_dir && n.children) {
      const found = findNode(n.children, path);
      if (found) return found;
    }
  }
  return null;
}

// --- Refresh ---

async function refreshTree() {
  const root = getState().context?.root;
  if (!root) return;
  const tree = await getFileTree(root);
  setTree(tree);
}
