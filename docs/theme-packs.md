# Mcraftr Theme Packs

Mcraftr theme packs are JSON files that can bundle:

- interface colors
- accent color
- optional sound-effect settings
- optional background-music settings

Import them from `Settings -> Theme Packs` in the app.

## What A Theme Pack Can Control

Mcraftr supports these visual variables:

- `--bg`
- `--bg2`
- `--panel`
- `--border`
- `--text`
- `--text-dim`
- `--red`

It also supports:

- `accent`
- `soundEffects`
- `backgroundMusic`

## Minimal Example

```json
{
  "name": "Aurora Night",
  "vars": {
    "--bg": "#0a0f18",
    "--bg2": "#111a29",
    "--panel": "#152237",
    "--border": "#2a3b58",
    "--text": "#edf6ff",
    "--text-dim": "#8ea3b5",
    "--red": "#ff5d73"
  },
  "accent": "#59f3d2"
}
```

## Full Example With Sound And Music

```json
{
  "name": "Builder Ops",
  "vars": {
    "--bg": "#0b0d11",
    "--bg2": "#151922",
    "--panel": "#1b2230",
    "--border": "#33405a",
    "--text": "#f5f8ff",
    "--text-dim": "#98a7bf",
    "--red": "#ff5a67"
  },
  "accent": "#7df9ff",
  "soundEffects": {
    "masterEnabled": true,
    "volume": 0.55,
    "effects": {
      "uiClick": {
        "enabled": true,
        "source": { "type": "builtin", "id": "uiClick" }
      },
      "success": {
        "enabled": true,
        "source": { "type": "builtin", "id": "success" }
      },
      "notify": {
        "enabled": true,
        "source": { "type": "url", "url": "https://example.com/notify.ogg", "label": "Soft Ping" }
      },
      "error": {
        "enabled": true,
        "source": { "type": "builtin", "id": "error" }
      }
    }
  },
  "backgroundMusic": {
    "enabled": true,
    "volume": 0.25,
    "shuffle": true,
    "tracks": [
      { "type": "builtin", "id": "dryHands" },
      { "type": "builtin", "id": "livingMice" },
      { "type": "url", "url": "https://example.com/custom-theme-loop.ogg", "label": "Theme Loop" }
    ]
  }
}
```

## Media Source Types

Sound effects and music tracks support these sources:

### Built-in

```json
{ "type": "builtin", "id": "uiClick" }
```

Built-in sound effect IDs:

- `uiClick`
- `success`
- `notify`
- `error`

Built-in music IDs:

- `dryHands`
- `livingMice`
- `miceOnVenus`

### URL

```json
{ "type": "url", "url": "https://example.com/track.ogg", "label": "Custom Track" }
```

### Uploaded Asset

```json
{ "type": "upload", "assetId": "asset_xxx", "label": "Uploaded Track" }
```

Note: uploaded asset IDs are local to the browser/app environment that created them. If you want a portable theme pack, prefer built-in or URL-based sources.

## How Import Works

When you import a theme pack, Mcraftr will:

1. apply the visual theme variables and accent
2. apply any included sound-effect settings
3. apply any included background-music settings

Fields you omit are left alone.

## How Export Works

When you export from `Settings -> Theme Packs`, Mcraftr writes the current:

- theme variables
- accent color
- sound settings
- music settings

into one JSON file.

## Best Practices

- Prefer high-contrast text and border colors.
- Keep `--panel` and `--bg` visually distinct.
- Use `.ogg` audio when possible.
- Prefer URL-based audio for shareable packs.
- Treat uploaded-asset IDs as machine-local, not portable.

## Fast Workflow

1. Tune the app visually in `Settings`.
2. Configure sound effects and music.
3. Export a theme pack.
4. Edit the JSON by hand if needed.
5. Re-import and iterate.
