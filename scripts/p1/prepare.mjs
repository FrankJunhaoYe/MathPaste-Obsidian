import { build } from 'esbuild';
import { mkdir, writeFile, copyFile, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBuildOptions } from '../build-options.mjs';

export function validateTarget(target, repo) {
  if (!target || !isAbsolute(target)) throw new Error('Provide an absolute, NEW test-vault path.');
  const relation = relative(resolve(repo), resolve(target));
  if (
    !relation ||
    (relation !== '..' && !relation.startsWith(`..${sep}`) && !isAbsolute(relation))
  ) {
    throw new Error('The test vault must be outside the repository.');
  }
  const inverse = relative(resolve(target), resolve(repo));
  if (!inverse || (inverse !== '..' && !inverse.startsWith(`..${sep}`) && !isAbsolute(inverse))) {
    throw new Error('The test vault cannot contain the repository.');
  }
  return resolve(target);
}

export async function prepareVault(target, livePreview = false) {
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const requested = validateTarget(target, repo);
  // Resolve the parent too, so junctions/symlinks cannot put a test vault in the repo.
  const vault = validateTarget(
    join(await realpath(dirname(requested)), relative(dirname(requested), requested)),
    await realpath(repo),
  );
  // No recursive mkdir here: existing directories (including real vaults) are refused.
  await mkdir(vault);
  const plugin = join(vault, '.obsidian', 'plugins', 'mathpaste-p1-probe');
  await mkdir(plugin, { recursive: true });
  await build({
    ...createBuildOptions(),
    absWorkingDir: repo,
    entryPoints: ['scripts/p1/probe.ts'],
    outfile: join(plugin, 'main.js'),
    minify: false,
  });
  await writeFile(
    join(vault, 'mathpaste-p1-marker.json'),
    JSON.stringify({ purpose: 'MathPaste isolated P1 probe v1' }),
  );
  await writeFile(join(vault, '.obsidian', 'app.json'), JSON.stringify({ livePreview }));
  await writeFile(
    join(plugin, 'manifest.json'),
    JSON.stringify(
      {
        id: 'mathpaste-p1-probe',
        name: 'MathPaste P1 probe (test vault only)',
        version: '0.1.0',
        minAppVersion: '1.1.0',
        description: 'Synthetic P1 API checks; not the MathPaste converter.',
        author: 'FrankJunhaoYe',
        isDesktopOnly: true,
      },
      null,
      2,
    ),
  );
  // Install the actual production scaffold alongside the probe (it still has no conversion behavior).
  const production = join(vault, '.obsidian', 'plugins', 'mathpaste');
  await mkdir(production);
  await copyFile(join(repo, 'main.js'), join(production, 'main.js'));
  await copyFile(join(repo, 'manifest.json'), join(production, 'manifest.json'));
  await writeFile(
    join(vault, '.obsidian', 'community-plugins.json'),
    JSON.stringify(['mathpaste', 'mathpaste-p1-probe']),
  );
  console.log(`Prepared isolated ${livePreview ? 'Live Preview' : 'Source'} probe: ${vault}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareVault(process.argv[2], process.argv.includes('--live-preview'));
}
