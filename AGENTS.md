# AGENTS.md

mdcat — Git-aware markdown viewer for macOS. Tauri v2 app with TypeScript frontend (Vite, CodeMirror) and Rust backend.

---

## General Rules

- **File size**: Under ~500 LOC. Current components are 40-195 LOC each — keep it that way.
- **No framework**: Vanilla TS + DOM API. Components are functions returning `HTMLElement`. Don't introduce React/Vue/etc.
- **State pattern**: Pub/sub in `src/state.ts`. Subscribe to changes, mutate via setters. Keep it explicit.
- **IPC pattern**: Thin wrappers in `src/ipc.ts` calling Tauri `invoke()`. Backend commands in `src-tauri/src/commands.rs`.
- **Styling**: All CSS in `src/style.css`. Use GitHub-flavored markdown styling conventions.
- **Naming**: camelCase for TS, snake_case for Rust. File names match export names.

---

## Build / Test

- **Dev server**: `npm run tauri dev` — starts Vite (port 1420) + Tauri window with HMR
- **Typecheck**: `npm run build` runs `tsc && vite build`. Use `npx tsc --noEmit` for quick type-only check.
- **Build app**: `npm run tauri build` → outputs `/src-tauri/target/release/bundle/macos/mdcat.app`
- **Rust check**: `cd src-tauri && cargo check` for backend-only validation
- **No test suite**: Project has no tests. Manual testing required.

---

## Repo Tour

```
src/
├── main.ts              # Init, keyboard shortcuts (⌘E/S/O/+/-/0), zoom
├── state.ts             # Pub/sub state: file, content, mode, context, tree
├── types.ts             # AppContext, FileNode, AppMode interfaces
├── ipc.ts               # Tauri invoke wrappers
├── style.css            # All styling
├── components/
│   ├── layout.ts        # Main layout + resize handle
│   ├── toolbar.ts       # Top toolbar buttons
│   ├── file-tree.ts     # Sidebar with collapsible tree
│   ├── editor.ts        # CodeMirror 6 wrapper
│   └── preview.ts       # Markdown preview renderer
└── utils/
    ├── markdown.ts      # marked + YAML frontmatter handling
    ├── watcher.ts       # Tauri plugin-fs file watcher
    └── icons.ts         # SVG icon components

src-tauri/
├── src/
│   ├── lib.rs           # Tauri setup, CLI parsing, macOS "Open With"
│   ├── commands.rs      # IPC commands: get_context, get_file_tree, read_file, save_file
│   ├── file_tree.rs     # Git root detection, tree building, filtering
│   └── main.rs          # Entry point
├── tauri.conf.json      # Window config, file associations, bundle settings
└── Cargo.toml           # Rust deps

assets/icons/            # App icons (32, 128, @2x, .icns, .ico)
docs/                    # Guides (macos-icon.md)
```

---

## Patterns

### Adding a Component
1. Create `src/components/<name>.ts` exporting `function create<Name>(): HTMLElement`
2. Subscribe to state changes inside the function
3. Return the root element
4. Import and mount in `src/components/layout.ts` or `main.ts`

### Adding an IPC Command
1. Define command in `src-tauri/src/commands.rs` with `#[tauri::command]`
2. Register in `src-tauri/src/lib.rs` `.invoke_handler()`
3. Add TS wrapper in `src/ipc.ts`
4. Call via wrapper (never raw `invoke()` in components)

### Keyboard Shortcuts
- Defined in `src/main.ts` via `keydown` event listener
- Check `e.metaKey` for ⌘ on macOS
- Use `e.preventDefault()` to block browser defaults

---

## File Tree Logic

- **Git detection**: Runs `git rev-parse --show-toplevel` to find repo root
- **Filters out**: hidden dirs (`.`), `node_modules/`, `target/`
- **Includes only**: `.md`, `.MD`, `.markdown` files
- **Prunes**: Empty directories removed from tree
- Backend: `src-tauri/src/file_tree.rs`

---

## Contracts

- **State shape**: `{ file, content, originalContent, mode, context, tree }` — see `src/state.ts`
- **FileNode**: `{ name, path, is_dir, children }` — returned by `get_file_tree`
- **AppContext**: `{ root, label }` — context for current folder
- **AppMode**: `"edit"` | `"preview"` — controls visible pane
- **Dirty detection**: `content !== originalContent` — blocks file reload if true

---

## Debug

- **White screen**: Check Vite console (`localhost:1420`), browser DevTools
- **IPC fails**: Check Rust panics in terminal, verify command registration in `lib.rs`
- **File tree empty**: Check Git root detection, filter logic in `file_tree.rs`
- **Shortcuts not working**: Ensure focus is on window, check `keydown` handler in `main.ts`

---

## Git

- **Commits**: Conventional format (`feat:`, `fix:`, `refactor:`, `docs:`, etc.)
- **Branch**: Work on `main` unless directed otherwise
- **Build before commit**: Run `npm run build` to catch TS errors
