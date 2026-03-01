# mdcat

A Git-aware markdown viewer for macOS, built for developers who live in repositories full of `.md` files.

Open any markdown file — mdcat detects its Git repo and displays every `.md` file in the project as a navigable tree in the sidebar. No setup, no config, no project files. Just open a file and browse.

## Why

AI agents generate and consume markdown at scale — `CLAUDE.md`, `AGENTS.md`, specs, changelogs, task lists, docs. These files live scattered across repos, and reading them in a code editor means fighting syntax highlighting meant for code, not prose.

mdcat treats markdown as a first-class format: GitHub-styled preview by default, instant file switching via the sidebar tree, and a built-in editor when you need to make changes.

## Features

- **Git-aware sidebar** — auto-detects the repo root and shows all markdown files as a collapsible tree
- **Split-pane editing** — live preview alongside a CodeMirror editor; toggle with `⌘E` or double-click preview
- **File watching** — reloads on external changes (respects unsaved edits)
- **YAML frontmatter** — rendered as a code block in preview
- **Code highlighting** — syntax highlighting in both editor and preview via highlight.js
- **Mermaid diagrams** — fenced `mermaid` blocks render as inline SVG diagrams
- **Zoom** — `⌘+` / `⌘-` / `⌘0` with toast indicator
- **macOS integration** — registers as handler for `.md`, `.markdown`, `.mdown`, `.mkd`; supports "Open With"
- **GitHub-flavored styling** — preview uses `github-markdown-css`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘E` | Toggle editor / preview |
| `⌘S` | Save |
| `⌘O` | Open file |
| `⌘+` / `⌘-` | Zoom in / out |
| `⌘0` | Reset zoom |

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop framework | Tauri v2 |
| Frontend | TypeScript, Vite |
| Editor | CodeMirror 6 |
| Markdown | marked + highlight.js |
| Backend | Rust (file I/O, git detection, file tree) |

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build

# output: src-tauri/target/release/bundle/macos/mdcat.app
```

## Install (macOS)

```bash
# installs to /Applications (falls back to ~/Applications if no permission)
npm run install:app

# or
bun cli.ts install
```

## Project Structure

```
src/                  # TypeScript frontend
  components/         # layout, toolbar, editor, preview, file-tree
  utils/              # markdown parser, file watcher, icons
  main.ts             # app init, shortcuts, zoom
  state.ts            # pub/sub state management
src-tauri/            # Rust backend
  src/commands.rs     # Tauri IPC commands
  src/file_tree.rs    # git detection, file tree building
  src/lib.rs          # app setup, CLI + "Open With" handling
```
