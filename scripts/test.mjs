import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('test-results', { recursive: true });
await build({ entryPoints: ['src/engine.ts'], outfile: 'test-results/engine.mjs', platform: 'node', format: 'esm', bundle: true });
await import('../tests/engine.test.mjs');
