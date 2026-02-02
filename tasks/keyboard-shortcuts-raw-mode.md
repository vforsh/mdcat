# Markdown Formatting Shortcuts in Raw Mode

## Overview

Add standard markdown formatting keyboard shortcuts to the CodeMirror editor in raw/edit mode. Shortcuts should toggle formatting on/off and handle both selection and no-selection cases.

## Shortcuts

| Shortcut | Action | Marker/Template |
|----------|--------|-----------------|
| `Mod-b` | Toggle **bold** | `**text**` |
| `Mod-i` | Toggle *italic* | `*text*` |
| `` Mod-` `` | Toggle `inline code` | `` `text` `` |
| `Mod-Shift-x` | Toggle ~~strikethrough~~ | `~~text~~` |
| `Mod-k` | Insert link | `[text](url)` |
| `Mod-Shift-k` | Insert image | `![alt](url)` |

> `Mod` = Cmd on macOS, Ctrl on Windows/Linux (CodeMirror convention)

## Files to Change

### 1. New file: `src/utils/keybindings.ts` (~70 LOC)

Exports:
- `markdownKeymap: KeyBinding[]` — array of CodeMirror keybindings

Internal helpers:
- `toggleWrap(view: EditorView, marker: string): boolean` — generic symmetric wrap/unwrap for bold, italic, code, strikethrough
- `insertTemplate(view: EditorView, prefix: string, urlPlaceholder: string): boolean` — structured template for link/image

### 2. Modify: `src/components/editor.ts` (1-line change)

Replace empty keymap with the new bindings:

```ts
// Before
keymap.of([]),

// After
import { markdownKeymap } from "../utils/keybindings";
keymap.of(markdownKeymap),
```

## Detailed Behavior

### `toggleWrap(view, marker)`

Uses CodeMirror's `state.changeByRange()` for multi-cursor support.

**With selection:**
1. Peek `marker.length` chars before and after selection range
2. If both match the marker → **unwrap**: delete surrounding markers, shrink selection
3. Also check if selection itself starts/ends with marker → **unwrap** from inside
4. Otherwise → **wrap**: surround selection with markers, keep text selected

**Without selection (cursor only):**
- Insert `marker + marker`, place cursor between them (e.g., `**|**`)

### `insertTemplate(view, prefix)`

**Without selection:**
- Insert `{prefix}[text](url)`, select the word "text" so user can type link text immediately

**With selection:**
- Use selected text as link text: `{prefix}[selected](url)`, select "url" placeholder so user can paste URL

Prefix is `""` for links, `"!"` for images.

## Edge Cases

| Case | Handling |
|------|----------|
| Cursor at line start/end | Works — inserts markers at cursor position |
| Multi-line selection | Wraps entire selection; `**line1\nline2**` is valid markdown |
| Nested formatting (bold inside italic) | Each toggle operates independently; `***text***` for bold+italic works correctly |
| Italic uses `*` not `_` | Consistent, avoids identifier ambiguity |
| Multi-cursor | Free via `changeByRange` — each cursor/selection handled independently |
| Selection includes partial marker | Falls through to wrap (safe default) |

## Conflict Analysis

| Shortcut | `basicSetup` | `main.ts` keydown | macOS system | Status |
|----------|-------------|-------------------|-------------|--------|
| `Mod-b` | Not bound | Not bound | Not bound in webview | OK |
| `Mod-i` | Not bound | Not bound | Not bound in webview | OK |
| `` Mod-` `` | Not bound | Not bound | Window cycling | Test needed |
| `Mod-Shift-x` | Not bound | Not bound | Not bound | OK |
| `Mod-k` | Not bound | Not bound | Not bound | OK |
| `Mod-Shift-k` | Not bound | Not bound | Not bound | OK |

> `` Mod-` `` note: macOS uses Cmd+` to cycle windows of the same app. In a Tauri webview, CodeMirror should capture this before the system. If not, fallback: `` Mod-Shift-` ``.

## Dependencies

None — all APIs come from already-installed `@codemirror/state` and `@codemirror/view`.

## Verification

1. `npm run build` — TypeScript typecheck + Vite bundle (no errors)
2. Manual test matrix:
   - Each shortcut with no selection → markers inserted, cursor between
   - Each shortcut with selection → text wrapped/templated
   - Toggle on then off → round-trip clean (markers removed)
   - Link/image with selection → URL placeholder selected
   - Nested: bold on italic text → `***text***`
   - `` Mod-` `` works on macOS (or note if system captures it)
