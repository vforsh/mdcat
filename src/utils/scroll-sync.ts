import { getState, toggleMode } from "../state";
import { getPreviewVisibleLine } from "../components/preview";
import { getEditorVisibleLine, goToLine } from "../components/editor";
import { scrollPreviewToLine } from "../components/layout";

export function syncToggleMode() {
  const line = getState().mode === "preview"
    ? getPreviewVisibleLine()
    : getEditorVisibleLine();
  toggleMode();
  // Double-rAF: first frame renders the target pane, second frame scrolls it
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (getState().mode === "preview") {
        scrollPreviewToLine(line);
      } else {
        goToLine(line, false);
      }
    });
  });
}
