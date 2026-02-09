#!/bin/bash
set -euo pipefail

# Install mdcat.app into /Applications (or ~/Applications fallback).
#
# Supports:
# - installing from a built .app bundle path
# - installing from a .dmg (mount, copy .app, detach)
#
# Usage:
#   ./scripts/install-macos.sh [--user] [--target <dir>] [--source <path-to-app-or-dmg>]
#
# Examples:
#   ./scripts/install-macos.sh
#   ./scripts/install-macos.sh --user
#   ./scripts/install-macos.sh --source src-tauri/target/release/bundle/dmg/mdcat_0.1.0_aarch64.dmg

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_APP="$ROOT_DIR/src-tauri/target/release/bundle/macos/mdcat.app"

TARGET_DIR="/Applications"
SOURCE_PATH="$DEFAULT_APP"
FORCE_USER=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)
      FORCE_USER=1
      shift
      ;;
    --target)
      TARGET_DIR="${2:-}"
      shift 2
      ;;
    --source)
      SOURCE_PATH="${2:-}"
      shift 2
      ;;
    -h|--help)
      sed -n '1,60p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ $FORCE_USER -eq 1 ]]; then
  TARGET_DIR="$HOME/Applications"
fi

mkdir -p "$TARGET_DIR"

if [[ ! -w "$TARGET_DIR" ]]; then
  echo "No write permission for $TARGET_DIR; falling back to $HOME/Applications" >&2
  TARGET_DIR="$HOME/Applications"
  mkdir -p "$TARGET_DIR"
fi

copy_app_bundle() {
  local src_app="$1"
  local dest_dir="$2"

  if [[ ! -d "$src_app" ]]; then
    echo "Source app not found: $src_app" >&2
    exit 1
  fi

  local dest_app="$dest_dir/$(basename "$src_app")"
  local ts
  ts="$(date -u "+%Y%m%d%H%M%S")"

  local stage_dir
  stage_dir="$(mktemp -d)"

  echo "Staging app..."
  ditto --rsrc --extattr "$src_app" "$stage_dir/$(basename "$src_app")"

  if [[ -e "$dest_app" ]]; then
    local backup="$dest_app.bak.$ts"
    echo "Existing install found; moving to: $backup"
    mv "$dest_app" "$backup"
  fi

  echo "Installing to: $dest_app"
  mv "$stage_dir/$(basename "$src_app")" "$dest_app"

  # Best-effort: remove quarantine xattr (useful for locally built artifacts).
  xattr -dr com.apple.quarantine "$dest_app" 2>/dev/null || true

  rm -rf "$stage_dir"

  echo "Installed: $dest_app"
}

mount_dmg_and_copy() {
  local dmg="$1"

  if [[ ! -f "$dmg" ]]; then
    echo "DMG not found: $dmg" >&2
    exit 1
  fi

  echo "Mounting DMG: $dmg"
  local attach_out
  attach_out="$(hdiutil attach -nobrowse -readonly "$dmg")"
  local mount_point
  mount_point="$(echo "$attach_out" | awk 'END {print $3}')"

  if [[ -z "$mount_point" || ! -d "$mount_point" ]]; then
    echo "Failed to determine mount point for DMG" >&2
    echo "$attach_out" >&2
    exit 1
  fi

  local app_in_dmg
  app_in_dmg="$(ls -1d "$mount_point"/*.app 2>/dev/null | head -n 1 || true)"
  if [[ -z "$app_in_dmg" ]]; then
    echo "No .app found inside DMG at $mount_point" >&2
    hdiutil detach "$mount_point" >/dev/null || true
    exit 1
  fi

  copy_app_bundle "$app_in_dmg" "$TARGET_DIR"

  echo "Detaching DMG: $mount_point"
  hdiutil detach "$mount_point" >/dev/null
}

case "$SOURCE_PATH" in
  *.dmg)
    mount_dmg_and_copy "$SOURCE_PATH"
    ;;
  *.app|*)
    copy_app_bundle "$SOURCE_PATH" "$TARGET_DIR"
    ;;
esac
