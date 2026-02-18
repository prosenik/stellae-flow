# stellae.flow

A Figma plugin that auto-generates user flow diagrams from prototype connections.

## Features

- **Prototype Connection Reader** — Scans all prototype connections on the current page
- **Flow Diagram Generator** — Creates clean flow diagrams with screen thumbnails and labeled arrows
- **Auto-Layout** — Uses dagre.js for intelligent graph layout (LTR or top-down)
- **Flow Highlighting** — Color-coded paths (Pro)
- **Export** — PNG (Free) and PDF (Pro) export

## Development

```bash
npm install
npm run build     # Build once
npm run watch     # Watch mode
```

## Installation in Figma

1. Open Figma → Plugins → Development → Import plugin from manifest
2. Select the `manifest.json` file from this project

## Pricing Tiers

| Feature | Free | Pro ($6/mo) |
|---------|------|-------------|
| Screens | Up to 10 | Unlimited |
| Layout | ✅ | ✅ |
| Flow Highlighting | ❌ | ✅ |
| Interaction Labels | ❌ | ✅ |
| PNG Export | ✅ | ✅ |
| PDF Export | ❌ | ✅ |

## Tech Stack

- TypeScript
- Figma Plugin API
- dagre.js (graph layout)
- esbuild (bundling)
