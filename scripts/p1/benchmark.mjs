import { fromMarkdown } from 'mdast-util-from-markdown';
import { largeFixture } from './fixtures.ts';

for (const size of [10_000, 1_000_000]) {
  const text = largeFixture(size);
  const start = performance.now();
  const tree = fromMarkdown(text);
  console.log(
    JSON.stringify({
      parser: 'mdast-util-from-markdown',
      length: text.length,
      elapsedMs: Math.round(performance.now() - start),
      endOffset: tree.position?.end.offset,
    }),
  );
}
