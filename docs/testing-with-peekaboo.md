# Testing mdcat with Peekaboo

Guide for AI coding agents to verify UI changes in mdcat using [Peekaboo](https://github.com/steipete/Peekaboo) — a macOS CLI for screen capture and accessibility-driven UI automation.

---

## Prerequisites

- mdcat running via `npm run tauri dev`
- Peekaboo installed: `brew install steipete/tap/peekaboo`
- Permissions granted: Screen Recording + Accessibility (`peekaboo permissions status`)

## Finding the App

mdcat is a Tauri app. The process name is `mdcat`.

```bash
# Confirm mdcat is running
peekaboo list | grep -i mdcat

# Get PID (needed if --app times out)
peekaboo list apps --json-output | jq '.[] | select(.name | test("mdcat"; "i"))'
```

> **Timeout workaround**: Tauri apps may timeout with `--app "mdcat"`. If so, use `--pid <PID>` instead. Get the PID from `peekaboo list`. If `--pid` also times out, fall back to `screencapture -l <windowID>` (get window ID from `peekaboo list windows --app mdcat --include-details bounds`).

---

## Taking Screenshots

```bash
# Annotated screenshot with element IDs (primary method)
peekaboo see --app "mdcat" --annotate --path /tmp/mdcat-ui.png --json-output > /tmp/mdcat-ui.json

# Raw screenshot (no annotations)
peekaboo image --app "mdcat" --retina --path /tmp/mdcat-screenshot.png

# Fallback via native screencapture (always works)
WINDOW_ID=$(peekaboo list windows --app mdcat --include-details bounds --json-output | jq '.[0].windowId')
screencapture -l "$WINDOW_ID" /tmp/mdcat-screenshot.png
```

---

## UI Layout Reference

```
+----------------------------------------------------------+
| [x]        filename.md [edited]        [Preview | Edit]  |  <- toolbar
+------------+---------------------------------------------+
|            | search panel (hidden by default)            |
| sidebar    | [input] 1/N [Aa] [^] [v] [x]                |
|            +---------------------------------------------+
| dir-name   |                                             |
|  > docs    |                                             |
|    file.md |  content pane (preview or editor)           |
|    note.md |                                             |
|            |                                             |
+------------+---------------------------------------------+
```

Key CSS classes for `peekaboo see` element identification:
- `.toolbar` — top bar (draggable)
- `.toolbar-close-btn` — close button (top-left)
- `.toolbar-filename` — centered filename display
- `.dirty-indicator` — `[edited]` badge (visible when unsaved)
- `.mode-toggle` — Preview/Edit toggle (top-right)
- `.sidebar` — left file tree panel
- `.sidebar-header` — folder name + "new file" button
- `.sidebar-tree` — scrollable file list
- `.tree-item` — individual file/folder row
- `.tree-item.active` — currently selected file
- `.content-pane` — main area (preview or editor)
- `.preview-wrap.markdown-body` — rendered markdown
- `.search-panel` — find bar (shown via ⌘F)
- `.search-input` — search text field
- `.resize-handle` — draggable sidebar resizer
- `.empty-state` — "Open a markdown file" placeholder

---

## Common Actions

### Open a File via Keyboard

```bash
# Focus the app
peekaboo hotkey cmd,tab   # if mdcat isn't focused

# ⌘O opens the native file dialog
peekaboo hotkey cmd,o

# Type the file path in the dialog and confirm
peekaboo type "/path/to/file.md" --return
```

### Open a File from the Sidebar

```bash
# Capture UI to find file tree elements
peekaboo see --app "mdcat" --json-output > /tmp/ui.json

# Click a file by its label text
peekaboo click "README.md"

# Or click by element ID from the see output
peekaboo click --on B5
```

### Toggle Preview / Edit Mode

```bash
# Via keyboard shortcut
peekaboo hotkey cmd,e

# Via toolbar buttons
peekaboo click "Preview"
peekaboo click "Edit"
```

### Verify Mode State

```bash
# Screenshot and check which toggle button is active
peekaboo see --app "mdcat" --json-output \
  | jq '.data.ui_elements[] | select(.label | test("Preview|Edit"))'
```

### Edit Content in Editor Mode

```bash
# Switch to edit mode first
peekaboo hotkey cmd,e

# Click in the editor area to focus it
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
peekaboo click --on <editor-element-id>

# Type content
peekaboo type "# New heading\n\nSome content here"
```

### Save a File

```bash
peekaboo hotkey cmd,s
```

### Verify Dirty State

After editing, check for the `[edited]` indicator:

```bash
peekaboo see --app "mdcat" --json-output \
  | jq '.data.ui_elements[] | select(.label | test("edited"))'

# Or take a screenshot and visually inspect
peekaboo image --app "mdcat" --path /tmp/mdcat-dirty.png
```

### Search (Find in File)

```bash
# Open search panel
peekaboo hotkey cmd,f

# Type search query
peekaboo type "search term"

# Navigate matches
peekaboo press enter              # next match
peekaboo hotkey shift,enter       # previous match

# Close search
peekaboo press escape
```

### Verify Search Results

```bash
# Check the match counter (e.g., "3 of 10")
peekaboo see --app "mdcat" --json-output \
  | jq '.data.ui_elements[] | select(.label | test("of \\d+"))'
```

### Toggle Case-Sensitive Search

```bash
# Open search, then click the "Aa" button
peekaboo hotkey cmd,f
peekaboo click "Aa"
```

### Zoom

```bash
peekaboo hotkey cmd,equal    # zoom in  (⌘+)
peekaboo hotkey cmd,minus    # zoom out (⌘-)
peekaboo hotkey cmd,0        # reset zoom
```

### Collapse/Expand Sidebar Folders

```bash
# Click a folder name to toggle
peekaboo click "docs"

# Or use arrow keys after focusing the tree
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
# Click the sidebar tree to focus it
peekaboo click --on <sidebar-tree-id>
peekaboo press arrow-down
peekaboo press arrow-right   # expand folder
peekaboo press arrow-left    # collapse folder
```

### Create a New File

```bash
# Click the "+" button in the sidebar header
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
peekaboo click --on <plus-button-id>

# Type the filename and confirm
peekaboo type "new-note.md" --return
```

### Rename a File (F2)

```bash
# Select a file in the sidebar first, then press F2
peekaboo click "old-name.md"
peekaboo press f2

# Type the new name and confirm
peekaboo type "new-name" --clear --return
```

### Context Menu (Right-Click)

```bash
# Right-click a file in the sidebar
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
peekaboo click --on <file-item-id> --right

# Then click a menu option
peekaboo click "Rename"
peekaboo click "Delete"
```

### Double-Click Preview to Jump to Editor

```bash
# Double-click a paragraph in preview mode to switch to editor at that line
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
peekaboo click --on <preview-element-id> --double
```

### Close the Window

```bash
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
# Click the close button (top-left red dot)
peekaboo click --on <close-btn-id>
```

---

## Verification Recipes

### Verify a File Loaded Successfully

```bash
# 1. Open a file
peekaboo hotkey cmd,o
peekaboo type "/path/to/test.md" --return
sleep 1

# 2. Check window title contains filename
peekaboo list windows --app "mdcat" --include-details bounds --json-output \
  | jq '.[0].title'

# 3. Screenshot to confirm content rendered
peekaboo image --app "mdcat" --path /tmp/mdcat-loaded.png
```

### Verify Edit → Save Roundtrip

```bash
# 1. Open file, switch to edit mode
peekaboo hotkey cmd,e

# 2. Make an edit
peekaboo type "test edit"

# 3. Confirm dirty indicator appears
peekaboo image --app "mdcat" --path /tmp/mdcat-dirty.png

# 4. Save
peekaboo hotkey cmd,s

# 5. Confirm dirty indicator disappears
peekaboo image --app "mdcat" --path /tmp/mdcat-saved.png
```

### Verify Preview Renders Markdown

```bash
# 1. Ensure preview mode is active
peekaboo click "Preview"

# 2. Screenshot the content area
peekaboo image --app "mdcat" --path /tmp/mdcat-preview.png

# 3. Optionally analyze with AI
peekaboo image --app "mdcat" --analyze "Does the preview show rendered markdown with headings, lists, and code blocks?"
```

### Verify Sidebar File Tree

```bash
# 1. Open a file from a git repo
# 2. Check sidebar shows directory structure
peekaboo see --app "mdcat" --json-output \
  | jq '[.data.ui_elements[] | select(.label | test("\\.md$"))]'

# 3. Screenshot for visual check
peekaboo image --app "mdcat" --path /tmp/mdcat-tree.png
```

### Verify Search Highlighting

```bash
# 1. Open a file with known content
# 2. Open search and type a term that appears multiple times
peekaboo hotkey cmd,f
peekaboo type "the"
sleep 0.5

# 3. Screenshot — matches should be highlighted in preview or editor
peekaboo image --app "mdcat" --path /tmp/mdcat-search.png

# 4. Navigate through matches
peekaboo press enter
sleep 0.3
peekaboo image --app "mdcat" --path /tmp/mdcat-search-next.png
```

---

## Tips

- **Always re-run `peekaboo see`** before clicking — element IDs are invalidated when UI changes.
- **Add `sleep 0.5`–`sleep 1`** between actions that trigger re-renders (file open, mode switch, search).
- **Use `--json-output` + `jq`** to programmatically find elements instead of hardcoding IDs.
- **Use `peekaboo image --analyze "..."`** for AI-powered visual assertions when exact element inspection isn't enough.
- **Prefer keyboard shortcuts** (⌘E, ⌘S, ⌘O, ⌘F, ⌘+/−/0, F2) over clicking — they're more reliable and don't depend on element IDs.
- **Window title** reflects the open file (`filename.md — mdcat`) — use `peekaboo list windows` to verify.
