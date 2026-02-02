import { getState, subscribe } from "../state";
import { createToolbar } from "./toolbar";
import { createFileTree } from "./file-tree";
import { createPreview } from "./preview";
import { createEditor } from "./editor";

export function createLayout(
  app: HTMLElement,
  onFileSelect: (path: string) => void,
) {
  const toolbar = createToolbar();
  app.appendChild(toolbar);

  const main = document.createElement("div");
  main.className = "main-layout";
  app.appendChild(main);

  const sidebar = createFileTree(onFileSelect);
  main.appendChild(sidebar);

  const contentPane = document.createElement("div");
  contentPane.className = "content-pane";
  main.appendChild(contentPane);

  // Empty state
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.innerHTML = `
    <div>Open a markdown file</div>
    <div><span class="shortcut">⌘O</span> to open &nbsp; <span class="shortcut">⌘E</span> to toggle editor</div>
  `;
  contentPane.appendChild(empty);

  const preview = createPreview();
  contentPane.appendChild(preview);

  const editor = createEditor();
  contentPane.appendChild(editor);

  // Hide empty state when file is loaded
  subscribe((state) => {
    empty.style.display = state.filePath ? "none" : "flex";
  });
  empty.style.display = getState().filePath ? "none" : "flex";
}
