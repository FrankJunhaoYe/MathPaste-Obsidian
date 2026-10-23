import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { createBuildOptions } from '../scripts/build-options.mjs';

const manifest = JSON.parse(
  await readFile(new URL('../manifest.json', import.meta.url), 'utf8'),
) as {
  id: string;
  name: string;
  version: string;
  minAppVersion: string;
  description: string;
  author: string;
  isDesktopOnly: boolean;
};
const packageInfo = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };
const versions = JSON.parse(
  await readFile(new URL('../versions.json', import.meta.url), 'utf8'),
) as Record<string, string>;

describe('Obsidian packaging contract', () => {
  it('provides the required desktop plugin metadata', () => {
    expect(manifest.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const value of [manifest.name, manifest.description]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.minAppVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.isDesktopOnly).toBe(true);
    expect(manifest.author).toBe('');
  });

  it('keeps package, manifest and compatibility versions aligned', () => {
    expect(manifest.version).toBe(packageInfo.version);
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
  });

  it('produces a CommonJS entry while keeping the host API external', async () => {
    const result = await build({
      ...createBuildOptions(),
      write: false,
      metafile: true,
      logLevel: 'silent',
    });

    const output = result.outputFiles.find((file) => file.path.endsWith('main.js'));
    expect(output).toBeDefined();
    expect(output?.text).toContain('module.exports');
    const imports = Object.values(result.metafile.outputs).flatMap((file) => file.imports);
    expect(imports).toContainEqual(
      expect.objectContaining({ path: 'obsidian', kind: 'require-call', external: true }),
    );
    expect(
      Object.keys(result.metafile.inputs).some((path) =>
        /node_modules\/(?:obsidian|@codemirror|@lezer)\//u.test(path),
      ),
    ).toBe(false);
  });
});
