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

| Element | Typical ID | Label |
|---------|-----------|-------|
| Close button | `elem_5` | `"Close window"` |
| Preview button | `elem_9` | `"Preview"` |
| Edit button | `elem_10` | `"Edit"` |
| New file button | `elem_12` | `"New file"` |
| Search input | `elem_19` | `"Search..."` |
| Case toggle (Aa) | `elem_21` | `"Aa"` |
| Previous match | `elem_22` | `"Previous (Shift+Enter)"` |
| Next match | `elem_23` | `"Next (Enter)"` |
| Close search | `elem_24` | `"Close (Escape)"` |

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
peekaboo see --app "mdcat" --json-output \
  | jq '[.data.ui_elements[] | select(.label == "Preview" or .label == "Edit")]'
```

Both buttons are always present. To determine active mode, take a screenshot and use `--analyze`:

```bash
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
SEARCH_ID=$(jq -r '.data.ui_elements[] | select(.label == "Search...") | .id' /tmp/ui.json)
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
# 1. Screenshot
peekaboo see --app "mdcat" --path /tmp/mdcat-loaded.png

# 2. AI check
peekaboo image --mode screen --path /tmp/mdcat-verify.png \
  --analyze "What file is open in the markdown viewer? Is content visible in the preview?"

# 3. Check sidebar shows .md files
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

## Tips

- **Always focus the app** with `osascript` before sending hotkeys — they go to the frontmost app.
- **Always re-run `peekaboo see`** before clicking — element IDs change on every UI update.
- **Use `osascript` for text input** — `peekaboo type` doesn't reliably reach Tauri webview inputs.
- **Use `--analyze`** for visual assertions that can't be checked via element inspection.
- **Add `sleep 0.3`–`sleep 1`** between actions that trigger re-renders.
- **Use `jq`** to programmatically extract element IDs from `see` JSON output.
- **Prefer keyboard shortcuts** (⌘E, ⌘S, ⌘O, ⌘F, F2) — they're more reliable than clicking.
- **For zoom shortcuts** (⌘+/⌘-/⌘0), use `osascript` — Peekaboo can't send `=`, `-`, `0` keys.
- **Window screenshots**: use `screencapture -l <windowID>` (get ID via `peekaboo list windows --app mdcat --include-details bounds,ids --json-output | jq '.data.windows[0].windowID'`).
