import { build, context } from 'esbuild';
import { createBuildOptions } from './scripts/build-options.mjs';

const watch = process.argv.includes('--watch');
const options = createBuildOptions(watch);

if (watch) {
  const buildContext = await context(options);
  await buildContext.watch();
} else {
  await build(options);
}
