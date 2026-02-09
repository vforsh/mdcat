# Testing mdcat with Peekaboo

Guide for AI coding agents to verify UI changes in mdcat using [Peekaboo](https://github.com/steipete/Peekaboo) — a macOS CLI for screen capture and accessibility-driven UI automation.

---

## Prerequisites

- mdcat running via `npm run tauri dev`
- Peekaboo installed: `brew install steipete/tap/peekaboo`
- Permissions granted: Screen Recording + Accessibility (`peekaboo permissions status`)

## Tauri-Specific Limitations

mdcat is a Tauri v2 app (WebKit webview). Several Peekaboo features behave differently than with native apps:

| Feature | Status | Notes |
|---------|--------|-------|
| `peekaboo see --app` | Works | Returns element IDs (`elem_N` format) and screenshot |
| `peekaboo image --app` | Fails | Times out on Tauri apps |
| `peekaboo image --pid` | Fails | Also times out |
| `peekaboo image --mode screen` | Works | Full-screen capture only |
| `screencapture -l <windowID>` | Works | Best for window-only screenshots |
| `peekaboo hotkey` | Mostly works | Fails for `=`, `-`, `0` keys — use `osascript` |
| `peekaboo click --on <id>` | Works | Must use element ID, not text query |
| `peekaboo click "text"` | Fails | Times out on Tauri |
| `peekaboo type` | Unreliable | Keystrokes often don't reach webview inputs |
| `peekaboo press` | Works | For special keys (enter, escape, f2, arrows) |
| `peekaboo image --analyze` | Works | AI vision analysis via `--mode screen` |

**Key takeaway**: Use `peekaboo see` for element detection, `hotkey`/`press` for keyboard actions, `osascript` for keystrokes that peekaboo can't handle, and `screencapture -l` for clean window screenshots.

---

## Finding the App

```bash
# Confirm mdcat is running and get its PID
peekaboo list | grep -i mdcat
# Look for the main process line, e.g.: "mdcat - PID: 91241 - Windows: 1"
```

---

## Taking Screenshots

```bash
# Method 1: peekaboo see (RECOMMENDED — also returns element IDs)
peekaboo see --app "mdcat" --path /tmp/mdcat-ui.png --json-output > /tmp/mdcat-ui.json

# Method 2: native screencapture (clean window-only shot, always works)
WINDOW_ID=$(peekaboo list windows --app mdcat --include-details bounds,ids --json-output \
  | jq '.data.windows[] | select(.title != "") | .windowID')
screencapture -l "$WINDOW_ID" /tmp/mdcat-screenshot.png

# Method 3: full-screen capture
peekaboo image --mode screen --path /tmp/mdcat-screen.png

# Method 4: AI-powered visual analysis
peekaboo image --mode screen --path /tmp/mdcat-check.png \
  --analyze "Is a markdown file loaded? What mode is the app in?"
```

> **Do NOT use** `peekaboo image --app "mdcat"` or `--pid` — they time out on Tauri.

---

## Focusing the App

Peekaboo hotkeys go to whichever app is frontmost. Always focus mdcat first:

```bash
osascript -e 'tell application "System Events" to set frontmost of process "mdcat" to true'
sleep 0.3
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

Common element IDs returned by `peekaboo see --app "mdcat" --json-output`:

| Element | Typical ID | Label (ARIA) |
|---------|-----------|------|
| Close button | `elem_5` | `"Close window"` |
| Preview button | `elem_9` | `"Preview"` |
| Edit button | `elem_10` | `"Edit"` |
| New file button | `elem_12` | `"New file"` |
| Search input | `elem_19` | `"Search in document"` |
| Case toggle (Aa) | `elem_21` | `"Toggle case sensitivity"` |
| Previous match | `elem_22` | `"Previous match"` |
| Next match | `elem_23` | `"Next match"` |
| Close search | `elem_24` | `"Close search"` |
| Copy path buttons | varies | `"Copy path"` |

> Element IDs may shift when the UI changes. Always re-run `peekaboo see` to get fresh IDs.

---

## Common Actions

### Open a File via Dialog

```bash
osascript -e 'tell application "System Events" to set frontmost of process "mdcat" to true'
sleep 0.3
peekaboo hotkey cmd,o
sleep 1.5

# Navigate using the "Go to folder" sheet
peekaboo type "/Users/vlad/dev/mdcat/AGENTS.md"
peekaboo hotkey cmd,shift,g
sleep 1
peekaboo press enter   # select the path
sleep 0.5
peekaboo press enter   # confirm "Open"
```

> The dialog flow is fragile. When possible, prefer opening files via the sidebar or CLI args.

### Open a File from the Sidebar

```bash
# Capture UI to find file tree elements
peekaboo see --app "mdcat" --json-output > /tmp/ui.json

# Find the target file element
jq '.data.ui_elements[] | select(.label == "AGENTS.md")' /tmp/ui.json

# Click by element ID
peekaboo click --on elem_17
```

> Text-based click (`peekaboo click "AGENTS.md"`) times out on Tauri. Always use `--on <id>`.

### Toggle Preview / Edit Mode

```bash
osascript -e 'tell application "System Events" to set frontmost of process "mdcat" to true'
sleep 0.3
peekaboo hotkey cmd,e
```

### Verify Current Mode

```bash
# Method 1: Check aria-pressed on toggle buttons (preferred)
peekaboo see --app "mdcat" --json-output \
  | jq '.data.ui_elements[] | select(.label == "Preview" or .label == "Edit") | {label, pressed: .attributes["aria-pressed"]}'

# Method 2: State dump (most reliable)
peekaboo hotkey cmd,shift,d && sleep 0.3 && jq '.mode' /tmp/mdcat-state.json

# Method 3: AI visual analysis
peekaboo image --mode screen --path /tmp/mode-check.png \
  --analyze "Is the app in preview mode or edit mode? Which toggle button appears active/highlighted?"
```

### Save a File

```bash
osascript -e 'tell application "System Events" to set frontmost of process "mdcat" to true'
sleep 0.3
peekaboo hotkey cmd,s
```

### Search (Find in File)

```bash
osascript -e 'tell application "System Events" to set frontmost of process "mdcat" to true'
sleep 0.3

# Open search panel
peekaboo hotkey cmd,f
sleep 0.5

# Click the search input to ensure focus (type alone won't reach the webview)
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
SEARCH_ID=$(jq -r '.data.ui_elements[] | select(.label == "Search in document") | .id' /tmp/ui.json)
peekaboo click --on "$SEARCH_ID"
sleep 0.3

# Type search query via osascript (peekaboo type doesn't reach webview inputs)
osascript -e 'tell application "System Events" to keystroke "pattern"'
sleep 0.5

# Navigate matches
peekaboo press enter              # next match
peekaboo hotkey shift,enter       # previous match

# Close search
peekaboo press escape
```

### Zoom

Peekaboo can't send `=`, `-`, or `0` keys. Use `osascript`:

```bash
osascript -e 'tell application "System Events" to set frontmost of process "mdcat" to true'
sleep 0.3

# Zoom in (⌘+)
osascript -e 'tell application "System Events" to keystroke "=" using command down'

# Zoom out (⌘-)
osascript -e 'tell application "System Events" to keystroke "-" using command down'

# Reset zoom (⌘0)
osascript -e 'tell application "System Events" to keystroke "0" using command down'
```

### Collapse/Expand Sidebar Folders

```bash
# Click a folder by element ID
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
FOLDER_ID=$(jq -r '.data.ui_elements[] | select(.label == "docs") | .id' /tmp/ui.json)
peekaboo click --on "$FOLDER_ID"
```

### Click Sidebar Buttons (New File, etc.)

```bash
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
NEW_FILE_ID=$(jq -r '.data.ui_elements[] | select(.label == "New file") | .id' /tmp/ui.json)
peekaboo click --on "$NEW_FILE_ID"
sleep 0.3

# Type filename via osascript (webview input)
osascript -e 'tell application "System Events" to keystroke "new-note.md"'
peekaboo press return
```

### Rename a File (F2)

```bash
# Click a file in the sidebar first
peekaboo click --on <file-elem-id>
sleep 0.3
peekaboo press f2
sleep 0.3

# Type new name via osascript
osascript -e 'tell application "System Events" to keystroke "a" using command down'
osascript -e 'tell application "System Events" to keystroke "new-name.md"'
peekaboo press return
```

### Context Menu (Right-Click)

```bash
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
peekaboo click --on <file-elem-id> --right
sleep 0.3

# Re-scan to find context menu items
peekaboo see --app "mdcat" --json-output > /tmp/ctx.json
RENAME_ID=$(jq -r '.data.ui_elements[] | select(.label == "Rename") | .id' /tmp/ctx.json)
peekaboo click --on "$RENAME_ID"
```

### Close the Window

```bash
peekaboo see --app "mdcat" --json-output > /tmp/ui.json
CLOSE_ID=$(jq -r '.data.ui_elements[] | select(.label == "Close window") | .id' /tmp/ui.json)
peekaboo click --on "$CLOSE_ID"
```

---

## Verification Recipes

### Verify a File Loaded Successfully

```bash
# Method 1: State dump (most reliable)
peekaboo hotkey cmd,shift,d && sleep 0.3
jq '{file: .filePath, mode: .mode, contentLength: .contentLength}' /tmp/mdcat-state.json

# Method 2: Window title
peekaboo list windows --app mdcat --json-output | jq '.data.windows[0].title'
# → "mdcat - AGENTS.md"

# Method 3: Screenshot + AI check
peekaboo see --app "mdcat" --path /tmp/mdcat-loaded.png
peekaboo image --mode screen --path /tmp/mdcat-verify.png \
  --analyze "What file is open in the markdown viewer? Is content visible in the preview?"

# Method 4: Check sidebar shows .md files
peekaboo see --app "mdcat" --json-output \
  | jq '[.data.ui_elements[] | select(.label | test("\\.md$"))] | length'
```

### Verify Edit -> Save Roundtrip

```bash
osascript -e 'tell application "System Events" to set frontmost of process "mdcat" to true'
sleep 0.3

# 1. Switch to edit mode
peekaboo hotkey cmd,e
sleep 0.5

# 2. Screenshot before edit
screencapture -l "$WINDOW_ID" /tmp/mdcat-before.png

# 3. Click editor area and type (via osascript for webview)
osascript -e 'tell application "System Events" to keystroke "test edit"'
sleep 0.5

# 4. Screenshot — check for [edited] indicator
screencapture -l "$WINDOW_ID" /tmp/mdcat-dirty.png

# 5. Save and screenshot again
peekaboo hotkey cmd,s
sleep 0.5
screencapture -l "$WINDOW_ID" /tmp/mdcat-saved.png
```

### Verify Preview Renders Markdown

```bash
# Ensure preview mode, then analyze
osascript -e 'tell application "System Events" to set frontmost of process "mdcat" to true'
sleep 0.3
peekaboo hotkey cmd,e   # toggle if needed (ensure preview)
sleep 0.5

peekaboo image --mode screen --path /tmp/mdcat-preview.png \
  --analyze "Does the preview show rendered markdown with headings, lists, and code blocks? Or is it showing raw markdown source?"
```

### Verify Sidebar File Tree

```bash
peekaboo see --app "mdcat" --json-output \
  | jq '[.data.ui_elements[] | select(.label | test("\\.(md|MD|markdown)$"))]'
```

### Verify Search Highlighting

```bash
# After typing a search term (see Search section above):
peekaboo image --mode screen --path /tmp/mdcat-search.png \
  --analyze "Is text highlighted in the document? How many search matches are shown in the counter?"
```

---

## Programmatic State Inspection

### State Dump via ⌘⇧D

Press `⌘⇧D` to write a JSON snapshot of the app state to `/tmp/mdcat-state.json`:

```bash
osascript -e 'tell application "System Events" to set frontmost of process "mdcat" to true'
sleep 0.3
peekaboo hotkey cmd,shift,d
sleep 0.5
cat /tmp/mdcat-state.json
```

Returns:
```json
{
  "filePath": "/path/to/file.md",
  "mode": "preview",
  "dirty": false,
  "contentLength": 1234,
  "treeFileCount": 5,
  "search": { "open": false, "query": "", "totalMatches": 0 },
  "context": { "root": "/path/to/repo", "is_git": true },
  "timestamp": "2026-02-09T..."
}
```

### Debug API (dev mode only)

When running via `npm run tauri dev`, `window.__mdcat` is available in the browser console:

```bash
# In devtools console (localhost:1420):
window.__mdcat.getState()        // full state snapshot
window.__mdcat.toggleMode()      // toggle preview/edit
window.__mdcat.setMode("raw")    // set mode directly
window.__mdcat.openSearch()      // open search panel
window.__mdcat.closeSearch()     // close search panel
window.__mdcat.setSearchQuery("text")  // search for "text"
```

### ARIA Labels & data-testid Selectors

All interactive elements have ARIA labels for accessibility detection and `data-testid` attributes for stable selectors:

```bash
# Find elements by ARIA label
peekaboo see --app "mdcat" --json-output \
  | jq '.data.ui_elements[] | select(.label | test("Previous match|Next match|Close search|New file|Copy path|Toggle case"))'

# Window title includes filename (native title synced)
peekaboo list windows --app mdcat --json-output | jq '.data.windows[0].title'
# → "mdcat - AGENTS.md"
```

**data-testid reference:**

| Component | Selectors |
|-----------|-----------|
| Toolbar | `toolbar-close`, `toolbar-filename`, `toolbar-dirty`, `toolbar-preview-btn`, `toolbar-edit-btn` |
| Search | `search-panel`, `search-input`, `search-counter`, `search-case-btn`, `search-prev-btn`, `search-next-btn`, `search-close-btn` |
| File tree | `file-tree-header`, `file-tree`, `file-tree-add-btn`, `tree-dir-{name}`, `tree-file-{name}` |
| Context menu | `context-menu`, `context-menu-{label-slug}` |
| Preview | `preview-container`, `preview-content` |
| Editor | `editor-container` |

**ARIA reference:**

| Element | Attribute |
|---------|-----------|
| Preview/Edit buttons | `aria-pressed="true\|false"` |
| Search container | `role="search"` |
| Search input | `aria-label="Search in document"` |
| Search nav buttons | `aria-label="Previous match"`, `aria-label="Next match"` |
| Case toggle | `aria-label="Toggle case sensitivity"` |
| Close search | `aria-label="Close search"` |
| Tree container | `role="tree"` |
| Tree items | `role="treeitem"`, dirs get `aria-expanded="true\|false"` |
| New file button | `aria-label="New file"` |
| Copy path button | `aria-label="Copy path"` |
| Context menu | `role="menu"`, items: `role="menuitem"` |

---

## Tips

- **Always focus the app** with `osascript` before sending hotkeys — they go to the frontmost app.
- **Always re-run `peekaboo see`** before clicking — element IDs change on every UI update.
- **Use `osascript` for text input** — `peekaboo type` doesn't reliably reach Tauri webview inputs.
- **Use `--analyze`** for visual assertions that can't be checked via element inspection.
- **Use ⌘⇧D + `/tmp/mdcat-state.json`** for programmatic state assertions without screenshots.
- **Add `sleep 0.3`–`sleep 1`** between actions that trigger re-renders.
- **Use `jq`** to programmatically extract element IDs from `see` JSON output.
- **Prefer keyboard shortcuts** (⌘E, ⌘S, ⌘O, ⌘F, ⌘⇧D, F2) — they're more reliable than clicking.
- **For zoom shortcuts** (⌘+/⌘-/⌘0), use `osascript` — Peekaboo can't send `=`, `-`, `0` keys.
- **Window screenshots**: use `screencapture -l <windowID>` (get ID via `peekaboo list windows --app mdcat --include-details bounds,ids --json-output | jq '.data.windows[0].windowID'`).
