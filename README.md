# Rephraser (Chrome extension)

The Omarchy panel plugin, rebuilt as a Chrome extension so it runs the same on
Linux and macOS. Same three variations, same DeepSeek prompt, no Omarchy or
Quickshell dependency.

## Install (Linux or macOS)

Works in Chrome, Brave, Edge, Arc, and other Chromium browsers.

1. Download the zip:
   https://github.com/wndj2026/rephraser-chrome/releases/latest/download/rephraser-chrome.zip
2. Unzip it (double-click on macOS) so you have a folder with `manifest.json`.
3. Open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the unzipped folder.
5. Click the Rephraser icon, open the settings panel, and paste your DeepSeek API key.
6. Pin the extension so the icon stays in the toolbar.

No Web Store account and no build step. The zip is a plain unpacked extension.

## Use

- Click the toolbar icon, or press `Alt+Shift+R` (`Cmd+Shift+Y` on macOS).
- Type or paste a draft. `Enter` rephrases, `Shift+Enter` adds a new line.
- If you already selected text on the page, the popup picks it up.
- Right-click selected text and choose **Rephrase "..."** to open with that
  text filled in and run it right away.
- Click any variation to copy it. The popup stays open, so you can copy another.

## Updating on the Mac

Download the new zip and unzip it over the folder you loaded. Then press
**Reload** on the extension card in `chrome://extensions`. The API key stays
in the browser profile.

Chrome does not sync unpacked extensions, so the folder must exist on each
machine. That is also why the API key is entered once per machine.

## Build a zip locally

```bash
bash tools/package.sh
# -> dist/rephraser-chrome.zip
```

## Publish a new version

```bash
# bump "version" in manifest.json first
git tag v1.0.1
git push origin v1.0.1
```

The `Release` workflow rebuilds `dist/rephraser-chrome.zip` and attaches it to
the GitHub release for that tag. The `latest` download link above always points
at the newest release.

## Files

| File | Role |
| --- | --- |
| `manifest.json` | MV3 manifest, permissions, shortcut |
| `popup.html` / `popup.css` / `popup.js` | The toolbox UI, API call, copy to clipboard |
| `background.js` | Context menu entry for selected text |
| `icons/` | Toolbar icons |
| `tools/make-icons.py` | Regenerates the icons (`python3 tools/make-icons.py`) |
| `tools/package.sh` | Builds the release zip |
| `.github/workflows/release.yml` | Tag-triggered release build |

## Notes

- The key is stored with `chrome.storage.local`, readable by this extension
  only. Drafts are sent to `api.deepseek.com` when you press Rephrase.
- `deepseek-chat` is fixed in `popup.js` if you ever want a different model.
- Safari is not supported: it requires an Xcode-wrapped extension.
