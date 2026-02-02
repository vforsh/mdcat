import { EditorView, basicSetup } from "codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorState } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { getState, setContent, subscribe } from "../state";

let container: HTMLElement;
let view: EditorView | null = null;
let suppressUpdate = false;

export function createEditor(): HTMLElement {
  container = document.createElement("div");
  container.style.display = "none";
  container.style.height = "100%";

  subscribe(render);

  return container;
}

function initView(doc: string) {
  if (view) {
    view.destroy();
    view = null;
  }

  const state = EditorState.create({
    doc,
    extensions: [
      basicSetup,
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !suppressUpdate) {
          setContent(update.state.doc.toString());
        }
      }),
      keymap.of([]),
      EditorView.theme({
        "&": { height: "100%" },
        ".cm-scroller": { overflow: "auto" },
      }),
    ],
  });

  view = new EditorView({ state, parent: container });
}

function render(state: ReturnType<typeof getState>) {
  const visible = state.mode === "raw";
  container.style.display = visible ? "block" : "none";

  if (!visible) return;

  if (!view) {
    initView(state.content);
    return;
  }

  // Sync content from state → editor if needed (e.g. file reload)
  const editorContent = view.state.doc.toString();
  if (editorContent !== state.content && !state.dirty) {
    suppressUpdate = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: state.content },
    });
    suppressUpdate = false;
  }
}

export function getEditorContent(): string {
  return view?.state.doc.toString() || "";
}
