import { builtinModules } from 'node:module';

// Obsidian supplies these APIs at runtime; bundling another copy can break the editor.
/** @returns {import('esbuild').BuildOptions} */
export function createBuildOptions(development = false) {
  return {
    entryPoints: ['src/main.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2021',
    outfile: 'main.js',
    external: ['obsidian', 'electron', '@codemirror/*', '@lezer/*', ...builtinModules, 'node:*'],
    sourcemap: development ? 'inline' : false,
    minify: !development,
    treeShaking: true,
    logLevel: 'info',
  };
}
