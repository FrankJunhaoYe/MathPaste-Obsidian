import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { createBuildOptions } from '../scripts/build-options.mjs';
import { prepareVault, validateTarget } from '../scripts/p1/prepare.mjs';

describe('P1 developer probe isolation', () => {
  it('refuses relative paths, the repository, its descendants and its ancestors', () => {
    const repo = resolve('workspace', 'repo');
    for (const path of [
      '',
      'test-vault',
      repo,
      join(repo, 'vault'),
      join(repo, '..prefix'),
      resolve(repo, '..'),
    ]) {
      expect(() => validateTarget(path, repo)).toThrow();
    }
    expect(validateTarget(resolve(repo, '..', 'isolated'), repo)).toBe(
      resolve(repo, '..', 'isolated'),
    );
  });

  it('refuses existing directories without writing into them', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'mathpaste-p1-'));
    const existing = join(parent, 'existing');
    await mkdir(existing);
    await expect(prepareVault(existing)).rejects.toThrow();
    await expect(readFile(join(existing, 'mathpaste-p1-marker.json'))).rejects.toThrow();
  });

  it('keeps the developer probe out of the production bundle and host modules external', async () => {
    const production = await build({
      ...createBuildOptions(),
      write: false,
      metafile: true,
      logLevel: 'silent',
    });
    expect(
      Object.keys(production.metafile.inputs).some((path) => path.includes('scripts/p1/')),
    ).toBe(false);
    const probe = await build({
      ...createBuildOptions(),
      entryPoints: ['scripts/p1/probe.ts'],
      write: false,
      metafile: true,
      logLevel: 'silent',
    });
    const imports = Object.values(probe.metafile.outputs).flatMap((file) => file.imports);
    for (const path of [
      'obsidian',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      '@codemirror/commands',
    ]) {
      expect(imports).toContainEqual(expect.objectContaining({ path, external: true }));
    }
    expect(Object.keys(probe.metafile.inputs).some((path) => path.includes('node_modules/'))).toBe(
      false,
    );
  });
});
