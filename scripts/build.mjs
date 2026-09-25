import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('assets', { recursive: true });
await build({ entryPoints: ['src/app.ts'], outfile: 'assets/app.js', bundle: true, format: 'iife', target: 'es2022', minify: true, sourcemap: true });
await copyFile('src/styles.css', 'assets/styles.css');
// Keep the directly-openable local app and produce an explicit hosting artifact.
await mkdir('dist/assets', { recursive: true });
await copyFile('index.html', 'dist/index.html');
for (const file of ['app.js', 'app.js.map', 'styles.css', 'favicon.svg']) {
  await copyFile('assets/' + file, 'dist/assets/' + file);
}
console.log('Built local assets and deployment output in dist/.');
