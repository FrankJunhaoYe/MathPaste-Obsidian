import { build } from 'esbuild';
import { expect, it } from 'vitest';

it('bundles the pure conversion core for a browser without host or Node imports', async () => {
  const result = await build({
    entryPoints: ['src/converter.ts'],
    bundle: true,
    platform: 'browser',
    format: 'cjs',
    target: 'es2021',
    write: false,
    metafile: true,
    logLevel: 'silent',
  });
  expect(Object.values(result.metafile.outputs).flatMap((output) => output.imports)).toEqual([]);
  expect(
    Object.keys(result.metafile.inputs).some((path) =>
      /(?:obsidian|katex|@codemirror)\//u.test(path),
    ),
  ).toBe(false);
});
