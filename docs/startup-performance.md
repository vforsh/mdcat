# Startup Performance Analysis

**Last updated:** 2026-02-09  
**Commit:** `4ece602`  
**Platform:** macOS 24.6.0, Apple Silicon (arm64)

## TL;DR

- WKWebView init dominates startup (~90% of warm-start time in dev measurements).
- Real wins: remove duplicated work on fresh launch (`open-file` event + `getOpenedFile()`), kill extra `git` process spawns, delay non-critical background work until after first paint.
- Biggest perceived win (product decision): keep an instance resident and route "open file" into it (avoid process + WebView bring-up entirely for subsequent opens).

---

## Benchmark Setup

- **Test file:** `AGENTS.md` (125 lines)
- **Dev build:** debug Rust binary + Vite dev server (unbundled ESM)
- **Release build:** `npm run tauri build` → 11 MB arm64 binary, 1.6 MB main JS chunk
- **Method:** 5–7 runs, pre-warmed (first cold run discarded to exclude Gatekeeper/dyld cache)
- **Scripts:** `bench-startup.sh`, `bench-startup-v2.sh` in repo root

---

## Results

### End-to-end: process fork → content painted

| Build | Avg | Min | Max |
|-------|-----|-----|-----|
| Dev (debug binary + Vite) | 657 ms | 651 ms | 664 ms |
| Release (window visible only) | 216 ms | 211 ms | 223 ms |

> Release build "window visible" measures process fork → native window registered via osascript.
> It does **not** include JS execution or content render — those happen after.

### Measurement Gap (Release First Paint)

We currently do **not** have an automated release benchmark for: process fork → markdown painted.

`bench-startup-v2.sh` says "sentinel" but only polls for a window (same metric as `bench-startup.sh`). Fixing this is priority #0: without a release first-paint metric, it is easy to optimize the wrong thing.

Implementation: set `MDCAT_BENCH_SENTINEL=/tmp/mdcat-bench-ready` when launching the release binary. The frontend calls the `bench_ready` IPC after a double `requestAnimationFrame()` following initial content render.

### Release: process fork → first paint (sentinel)

`./bench-startup-v2.sh 7 AGENTS.md` (pre-fix baseline):

| Metric | Value |
|--------|-------|
| Avg    | 412 ms |
| Median | 408 ms |
| Min    | 401 ms |
| Max    | 431 ms |

After removing the fresh-launch `open-file` emit + 50ms sleep (`src-tauri/src/lib.rs`), new run:

| Metric | Value |
|--------|-------|
| Avg    | 426 ms |
| Median | 432 ms |
| Min    | 405 ms |
| Max    | 441 ms |

After also removing the double `git rev-parse` in `get_context` (compute git root once; `src-tauri/src/commands.rs`, `src-tauri/src/file_tree.rs`), new run:

| Metric | Value |
|--------|-------|
| Avg    | 414 ms |
| Median | 414 ms |
| Min    | 397 ms |
| Max    | 455 ms |

### Frontend JS breakdown (dev build, `performance.now()`)

| Phase | Timestamp | Delta | What happens |
|-------|-----------|-------|--------------|
| JS module eval starts | 0 ms | — | First line of `main.ts` executes |
| Imports resolved | 0 ms | 0 ms | ES imports are hoisted, no measurable gap |
| Layout created | 1 ms | +1 ms | `createLayout()` — DOM skeleton, toolbar, sidebar, preview, editor containers |
| `openFile()` called | 6 ms | +5 ms | `getOpenedFile()` IPC resolves, triggers file open |
| IPC done | 30 ms | +24 ms | `readFile()` + `getContext()` complete in parallel |
| State set + render | 39 ms | +9 ms | `setFile()` + `setContext()` → subscribers fire → markdown rendered to HTML |
| Content painted | 61 ms | +22 ms | Two `requestAnimationFrame` callbacks confirm pixels on screen |
| Phase 2 done | 51 ms | — | `setCurrentRoot()` + `getFileTree()` + `setTree()` (runs concurrently) |

### Time budget

```
0 ms         ~590 ms     ~620 ms   ~650 ms
|--- Rust + WebView ---|--- JS+IPC ---|--- paint ---|
       ~590 ms             ~30 ms        ~30 ms
         90%                 5%            5%
```

---

## Bottleneck Analysis

### 1. Tauri / WKWebView initialization — ~590 ms (90%)

The dominant cost is macOS WKWebView creation inside Tauri. This includes:

- Tauri builder setup (plugins, state, invoke handler)
- WKWebView process spawn and configuration
- WebView navigation to the frontend (embedded assets or dev server)
- Initial HTML parse, CSS load, JS module graph resolution

**We cannot directly control WKWebView creation time.** Apple's WebKit init is a fixed cost. However, reducing work done *before* the WebView starts loading frontend assets can help.

Relevant code: `src-tauri/src/lib.rs` — `tauri::Builder::default()` chain through `.build()`.

### 2. Fresh launch does duplicate work (event + polling)

On a CLI launch, Rust both:

- stores the path into state (for `get_opened_file`)
- emits an `open-file` event after a 50ms sleep

The frontend always calls `getOpenedFile()` at startup *and* listens for `open-file`, so the same file can be opened twice (two IPC reads + two renders). This is wasted CPU and can cause subtle races.

Relevant code:

- Rust: `src-tauri/src/lib.rs` (store state + emit `open-file`)
- Frontend: `src/main.ts` (both `listen("open-file")` and `getOpenedFile()`)

**Fix options (pick one):**

- **Simplest:** remove the `open-file` emit in `setup()` and rely on `getOpenedFile()` for fresh launch.
- **More "push" based:** keep emit, remove polling, but only emit after frontend is ready (handshake or `on_page_load` hook).

### 3. `thread::sleep(50ms)` in Rust setup — 50 ms (wasted delay)

`lib.rs:73` has a hardcoded 50 ms sleep to "ensure frontend listener is ready" before emitting the `open-file` event:

```rust
std::thread::spawn(move || {
    std::thread::sleep(std::time::Duration::from_millis(50));
    let _ = app_handle.emit("open-file", &path);
});
```

If we keep the event-based open, this sleep is pure latency. If we switch to state-based open only, the whole spawn+sleep+emit should be deleted.

**Fix:** delete the sleep (and ideally delete the entire `setup()` emit), or replace it with a proper ready signal.

### 4. Double `git rev-parse` in critical path — ~10-20 ms

When opening a file, `get_context()` calls:

1. `detect_git_root(&p)` — spawns `git rev-parse --show-toplevel`
2. `resolve_root(&p)` — calls `detect_git_root()` **again** internally

That's two `fork+exec` of `git` per file open.

Relevant code: `src-tauri/src/commands.rs` and `src-tauri/src/file_tree.rs`.

**Fix:** compute git root once and reuse it.

### 5. Two IPC roundtrips in the open-file critical path

Frontend startup calls `readFile()` and `getContext()` as separate commands. They run in parallel, but IPC overhead still exists twice.

Relevant code: `src/main.ts`.

**Fix:** introduce a single Rust command (e.g. `open_file(path) -> { content, context }`), or defer context detection until after first paint (render markdown using `dirname(path)` first, then update context/tree async).

### 6. CodeMirror loaded eagerly — ~250 KB

`src/components/editor.ts` imports the full CodeMirror stack at the top level:

```typescript
import { EditorView } from "codemirror";
import { lineNumbers, highlightActiveLineGutter, ... } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
```

The editor is **never shown at startup** — the default mode is `preview`. The `EditorView` instance is lazily created on first switch to raw mode, but all the modules are parsed and evaluated at page load.

**Fix:** dynamic import the heavy CodeMirror implementation. Note: `goToLine()` is imported by `src/components/preview.ts` and `src/components/layout.ts`, so a clean approach is a tiny wrapper module exporting `createEditor()`/`goToLine()` that internally `import()`s the real editor implementation on demand.

### 7. highlight.js: bundle size is not the problem; runtime highlighting can be

`src/utils/markdown.ts` imports full `highlight.js` (all languages) and calls `highlightAuto()` for unlabeled blocks.

Bundle-size impact: real but small vs WKWebView init. Runtime impact: can be large for code-heavy docs (especially `highlightAuto()` which tries multiple grammars).

**Fix options:**

- No auto-detect: if no language specified, render as plain code (fast, predictable).
- Defer highlighting: paint markdown first, then highlight code blocks in `requestIdleCallback` / next tick.
- Import `highlight.js/lib/core` + register a small language set; lazy-load extra languages if needed.

### 8. File tree build: avoid work and pick a faster source of truth

Even though tree building is in Phase 2, it can still contend for CPU/I/O and impact perceived responsiveness.

Problems today:

- `src/main.ts` rebuilds the entire tree on every `openFile()` call (even when root is unchanged).
- `src-tauri/src/file_tree.rs` uses `walkdir` and then assembles a tree with an `O(dirs * keys)` pattern.

Fix options:

- Root-change guard: only call `setCurrentRoot()` + `getFileTree()` when `ctx.root` changes.
- Cache per-root: keep last built tree in Rust state (or on disk) and return instantly on repeated calls.
- Git repos: use `git ls-files` (tracked + optionally `--others --exclude-standard`) to enumerate markdown files quickly, instead of `WalkDir` scanning the whole repo. This can be orders-of-magnitude faster on large monorepos.

### 9. No Cargo release profile optimizations

`Cargo.toml` has no `[profile.release]` section. Defaults are `opt-level=3`, but missing:

- `lto = true` — link-time optimization, can reduce binary from 11 MB
- `codegen-units = 1` — better optimization at cost of compile time
- `strip = true` — strip debug symbols
- `panic = "abort"` — smaller binary, faster unwind-free panics

**Fix:** Add to `Cargo.toml`:

```toml
[profile.release]
lto = true
codegen-units = 1
strip = true
panic = "abort"
```

This won't directly improve startup time (already optimized code), but reduces binary size which helps with disk I/O on cold starts and Gatekeeper scanning.

**Update:** Added `[profile.release]` in `src-tauri/Cargo.toml` with `lto=true`, `codegen-units=1`, `strip=true`, `panic=\"abort\"`.
Binary size dropped from ~12 MB to ~5.7 MB. On warm-start first-paint benchmark, median stayed roughly the same (~414 ms), as expected.

### 10. `@codemirror/language-data` registers all language parsers

The `languages` import from `@codemirror/language-data` registers a mapping table for ~90 language parsers. Vite already code-splits them into lazy chunks, but the mapping table and its metadata are in the main bundle. Combined with lazy-loading CodeMirror, deferring the editor entirely sidesteps this.

### 11. Instance registry I/O on every `getOpenedFile()`

`commands.rs:83` calls `take_queued_files()` which does filesystem I/O (read + delete of a queue file) even when nothing is queued. This is in the critical startup path.

**Fix:** Check file existence before read, or skip the queue check when the internal state already has a file.

---

## Priority Matrix

| # | Bottleneck | Time saved | Effort | Risk |
|---|-----------|-----------|--------|------|
| 0 | Add release "first paint" benchmark (sentinel) | Unblocks real tuning | Low | None |
| 1 | Remove duplicate fresh-open path (emit vs poll) | Avoid 2x open work | Low | Low |
| 2 | Remove 50ms sleep (or remove emit entirely) | Up to 50 ms | Trivial | Low |
| 3 | Fix double `git rev-parse` | 5-10 ms | Low | None |
| 4 | Combine IPC (`open_file`) or defer context to post-paint | 5-15 ms | Medium | Low |
| 5 | Root-change guard + cache tree | Jank reduction | Medium | Low |
| 6 | Lazy-load CodeMirror | Smaller initial JS | Medium | Low |
| 7 | Tame highlight.js runtime (`highlightAuto`) | Big for code-heavy docs | Medium | Medium |
| 8 | Cargo release profile (LTO/strip/panic abort) | Faster cold start | Trivial | Longer compile |

---

## Key Insight

**The frontend is not the bottleneck.** At 61 ms total (including two IPC roundtrips and markdown rendering), the JS side is already well-optimized. The 90% majority of startup time is spent in Tauri framework initialization and WKWebView process creation — a fixed cost we cannot meaningfully reduce.

The most impactful improvements come from:

- avoiding wasted work on fresh launch (open only once; avoid redundant IPC/git)
- tightening the critical path to first paint (defer context/tree/watchers until after first paint)
- product-level "startup" improvements (reuse a running instance so you avoid WKWebView init entirely)
