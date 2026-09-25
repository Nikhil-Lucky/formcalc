import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('assets', { recursive: true });
await build({ entryPoints: ['src/app.ts'], outfile: 'assets/app.js', bundle: true, format: 'iife', target: 'es2022', minify: true, sourcemap: true });
await copyFile('src/styles.css', 'assets/styles.css');
console.log('Built assets/app.js and assets/styles.css. Open index.html or run npm run dev.');
