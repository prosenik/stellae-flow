# stellae.flow ✦

**Auto-generate user flow diagrams from your Figma prototype connections.**

stellae.flow reads the prototype links you've already built in Figma and turns them into clean, layouted flow diagrams — no manual drawing required.

---

## ✨ Features

- **Prototype Connection Reader** — Automatically scans all prototype connections on the current page
- **Flow Diagram Generator** — Creates flow diagrams with screen thumbnails and labeled arrows
- **Intelligent Auto-Layout** — Uses dagre.js for clean graph layout (left-to-right or top-down)
- **Flow Highlighting** — Color-coded paths for different user journeys *(Pro)*
- **Interaction Labels** — Display trigger types (tap, hover, drag, etc.) on arrows *(Pro)*
- **Export** — PNG (Free) and PDF (Pro) export

---

## 🚀 How to Use

1. **Open your Figma file** with prototype connections already set up
2. **Run the plugin** — Plugins → stellae.flow → Generate Flow
3. **Select a page** — The plugin scans all frames with prototype connections
4. **Choose layout direction** — Left-to-right or top-down
5. **Generate** — Your flow diagram is created as a new frame on the canvas
6. **Export** — Use the built-in export to save as PNG or PDF

---

## 💎 Free vs Pro

| Feature | Free | Pro ($6/mo) |
|---------|:----:|:-----------:|
| Screens | Up to 10 | Unlimited |
| Auto-Layout | ✅ | ✅ |
| Flow Highlighting | — | ✅ |
| Interaction Labels | — | ✅ |
| PNG Export | ✅ | ✅ |
| PDF Export | — | ✅ |

---

## 📸 Screenshots

<!-- TODO: Add screenshots before Figma Community submission -->

| Plugin UI | Generated Flow | Export |
|-----------|---------------|--------|
| *Coming soon* | *Coming soon* | *Coming soon* |

---

## 🛠 Development

```bash
npm install
npm run build     # Build once
npm run watch     # Watch mode
npm test          # Run tests
```

### Install in Figma (Dev)

1. Figma → Plugins → Development → Import plugin from manifest
2. Select the `manifest.json` from this project

---

## Tech Stack

- TypeScript
- Figma Plugin API
- dagre.js (graph layout)
- esbuild (bundling)
- Vitest (testing)

---

## License

[MIT](LICENSE)
