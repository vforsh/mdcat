#!/usr/bin/env bun

import { resolve, join } from "node:path"
import { existsSync, statSync, readdirSync } from "node:fs"
import { $ } from "bun"

const APP_PATH = resolve(import.meta.dirname, "src-tauri/target/release/bundle/macos/mdcat.app")
const BIN_PATH = `${APP_PATH}/Contents/MacOS/mdcat`

if (!existsSync(BIN_PATH)) {
	console.error(`mdcat.app not found at ${APP_PATH}`)
	console.error(`Run: npm run tauri build`)
	process.exit(1)
}

const arg = process.argv[2]

if (arg === "--help" || arg === "-h") {
	console.log("Usage: mdcat [path]")
	console.log("       mdcat                 Open mdcat app")
	console.log("       mdcat README.md       Open file in mdcat")
	console.log("       mdcat .               Open directory (finds README.md or first .md)")
	process.exit(0)
}

if (arg) {
	const resolved = resolve(arg)
	if (!existsSync(resolved)) {
		console.error(`Not found: ${resolved}`)
		process.exit(1)
	}

	let file = resolved
	if (statSync(resolved).isDirectory()) {
		file = findMarkdownFile(resolved)
		if (!file) {
			console.error(`No markdown files found in ${resolved}`)
			process.exit(1)
		}
	}

	await $`open -a ${APP_PATH} ${file}`
} else {
	await $`open -a ${APP_PATH}`
}

function findMarkdownFile(dir: string): string | null {
	const files = readdirSync(dir)
	const priority = ["readme.md", "agents.md", "claude.md", "skill.md"]

	for (const name of priority) {
		const match = files.find((f) => f.toLowerCase() === name)
		if (match) return join(dir, match)
	}

	const md = files.find((f) => /\.(?:md|markdown)$/i.test(f))
	if (md) return join(dir, md)

	return null
}
