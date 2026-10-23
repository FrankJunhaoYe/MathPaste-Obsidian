import { readFile, copyFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createBuildOptions } from './build-options.mjs';
import { validateTarget } from './p1/prepare.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const requested = validateTarget(process.argv[2], repo);
const vault = validateTarget(await realpath(requested), await realpath(repo));
const marker = JSON.parse(await readFile(join(vault, 'mathpaste-p1-marker.json'), 'utf8'));
if (marker.purpose !== 'MathPaste isolated P1 probe v1')
  throw new Error('Requires the marked, dedicated P1 test vault');
await copyFile(join(repo, 'main.js'), join(vault, '.obsidian/plugins/mathpaste/main.js'));
await copyFile(
  join(repo, 'manifest.json'),
  join(vault, '.obsidian/plugins/mathpaste/manifest.json'),
);
await build({
  ...createBuildOptions(),
  absWorkingDir: repo,
  entryPoints: ['scripts/host-probe.ts'],
  outfile: join(vault, '.obsidian/plugins/mathpaste-p1-probe/main.js'),
  minify: false,
});
console.log('Updated only the marked test vault; reopen it to run synthetic host checks.');
