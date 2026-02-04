import { EditorView } from "codemirror";
import {
  lineNumbers,
  highlightActiveLineGutter,
  highlightSpecialChars,
  drawSelection,
  dropCursor,
  rectangularSelection,
  crosshairCursor,
  highlightActiveLine,
} from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
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
      // basicSetup minus foldGutter
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentOnInput(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      bracketMatching(),
      closeBrackets(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
      ]),
      // App-specific
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !suppressUpdate) {
          setContent(update.state.doc.toString());
        }
      }),
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

/** Move cursor to a specific line (1-indexed) and scroll it into view */
export function goToLine(line: number): void {
  if (!view) return;
  const doc = view.state.doc;
  const lineCount = doc.lines;
  const targetLine = Math.max(1, Math.min(line, lineCount));
  const lineInfo = doc.line(targetLine);
  view.dispatch({
    selection: { anchor: lineInfo.from },
    scrollIntoView: true,
  });
  view.focus();
}
