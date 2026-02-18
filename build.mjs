import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const watch = process.argv.includes('--watch');

// Build plugin sandbox code (no DOM, no imports from node_modules except inlined)
const codeBuild = {
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  target: 'es2020',
  format: 'iife',
  sourcemap: false,
};

// Build UI code and inline into HTML
const uiBuild = {
  entryPoints: ['src/ui.ts'],
  bundle: true,
  outfile: 'dist/ui-bundle.js',
  target: 'es2020',
  format: 'iife',
  sourcemap: false,
};

async function buildUI() {
  await esbuild.build(uiBuild);
  const js = fs.readFileSync('dist/ui-bundle.js', 'utf8');
  const css = fs.readFileSync('src/ui.css', 'utf8');
  const html = `<!DOCTYPE html>
<html>
<head><style>${css}</style></head>
<body>
<div id="app"></div>
<script>${js}</script>
</body>
</html>`;
  fs.writeFileSync('dist/ui.html', html);
  fs.unlinkSync('dist/ui-bundle.js');
  console.log('Built dist/ui.html');
}

async function buildAll() {
  fs.mkdirSync('dist', { recursive: true });
  await esbuild.build(codeBuild);
  console.log('Built dist/code.js');
  await buildUI();
}

if (watch) {
  // Simple watch with polling
  const ctx1 = await esbuild.context({ ...codeBuild, plugins: [{ name: 'log', setup(b) { b.onEnd(() => console.log('Rebuilt code.js')) } }] });
  await ctx1.watch();
  // For UI we just rebuild on change
  const ctx2 = await esbuild.context({ ...uiBuild, plugins: [{ name: 'rebuild-ui', setup(b) { b.onEnd(async () => { await buildUI(); }) } }] });
  await ctx2.watch();
  console.log('Watching...');
} else {
  await buildAll();
}
