# macOS App Icon

## Key Facts

- macOS does **not** auto-apply squircle mask to Tauri/Electron apps — bake it into the `.icns`
- Icon images **must be RGBA** (with alpha channel) — Tauri build fails on RGB-only PNGs
- macOS caches icons aggressively — clear cache after changes:
  ```bash
  sudo rm -rfv /Library/Caches/com.apple.iconservices.store
  killall Dock
  ```

## Safe Area

Do NOT draw to the edge. Artwork should sit inside a padded area of the 1024 canvas.

| Parameter | Value |
|-----------|-------|
| Canvas | 1024x1024 |
| Artwork | ~830x830 |
| Padding | ~97px per side (~19% total) |
| Squircle radius | ~40% |

Icons touching edges look amateur, clip on older macOS, and render poorly in Spotlight.

## Pipeline

Source: `app-icon-v4.png` (1024x1024, full-bleed, no rounding)

```bash
# 1. Apply squircle mask
eikon transform mask app-icon-v4.png --shape "squircle:40%" --out tmp-squircle.png

# 2. Resize to safe area
sips -z 830 830 tmp-squircle.png --out tmp-830.png

# 3. Pad back to 1024 with transparent background
eikon transform pad tmp-830.png --all 97 --bg-color "#00000000" --out app-icon-final.png

# 4. Convert to RGBA if needed
python3 -c "from PIL import Image; Image.open('icon.png').convert('RGBA').save('icon.png')"

# 5. Generate all sizes for .icns
SIZES="16 32 64 128 256 512 1024"
mkdir -p icon.iconset
sips -z 16 16   app-icon-final.png --out icon.iconset/icon_16x16.png
sips -z 32 32   app-icon-final.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32   app-icon-final.png --out icon.iconset/icon_32x32.png
sips -z 64 64   app-icon-final.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 app-icon-final.png --out icon.iconset/icon_128x128.png
sips -z 256 256 app-icon-final.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 app-icon-final.png --out icon.iconset/icon_256x256.png
sips -z 512 512 app-icon-final.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 app-icon-final.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 app-icon-final.png --out icon.iconset/icon_512x512@2x.png

# 6. Create .icns
iconutil -c icns icon.iconset -o src-tauri/icons/icon.icns

# 7. Copy PNG sizes for Tauri bundle config
sips -z 32 32   app-icon-final.png --out src-tauri/icons/32x32.png
sips -z 64 64   app-icon-final.png --out src-tauri/icons/64x64.png
sips -z 128 128 app-icon-final.png --out src-tauri/icons/128x128.png
sips -z 256 256 app-icon-final.png --out src-tauri/icons/128x128@2x.png
cp app-icon-final.png src-tauri/icons/icon.png
```

## Tauri Config

Icons referenced in `src-tauri/tauri.conf.json`:

```json
"icon": [
  "icons/32x32.png",
  "icons/128x128.png",
  "icons/128x128@2x.png",
  "icons/icon.icns",
  "icons/icon.ico"
]
```

## Files

| File | Purpose |
|------|---------|
| `app-icon-v4.png` | Source artwork (1024x1024, full-bleed, no mask) |
| `app-icon-v7-safe.png` | Final icon (squircle 40%, 830x830 in 1024 canvas) |
| `src-tauri/icons/icon.icns` | macOS icon bundle (all sizes) |
| `src-tauri/icons/*.png` | Individual sizes for Tauri |
