import { fromMarkdown } from 'mdast-util-from-markdown';
import { build } from 'esbuild';
import type { Nodes } from 'mdast';
import { describe, expect, it } from 'vitest';
import { PARSER_FIXTURE, largeFixture } from '../scripts/p1/fixtures';

function flatten(node: Nodes): Nodes[] {
  return [node, ...('children' in node ? node.children.flatMap(flatten) : [])];
}

describe('P1 independent CommonMark parser feasibility (not a converter)', () => {
  it('bundles for the browser without Node or host runtime dependencies', async () => {
    const result = await build({
      stdin: {
        contents: "export { fromMarkdown } from 'mdast-util-from-markdown';",
        resolveDir: process.cwd(),
      },
      bundle: true,
      platform: 'browser',
      format: 'cjs',
      target: 'es2021',
      write: false,
      metafile: true,
      logLevel: 'silent',
    });
    expect(Object.values(result.metafile.outputs).flatMap((output) => output.imports)).toEqual([]);
    expect(result.outputFiles[0]?.text).toContain('fromMarkdown');
  });
  it.each(['\n', '\r\n'])(
    'exposes original offsets for code, HTML and links with %j newlines',
    (newline) => {
      const text = PARSER_FIXTURE.replaceAll('\n', newline);
      const nodes = flatten(fromMarkdown(text));
      const protectedNodes = nodes.filter((node) =>
        ['code', 'inlineCode', 'html', 'link'].includes(node.type),
      );
      for (const marker of [
        'code',
        'fenced',
        'tilde',
        'indented',
        'quoted',
        'list-code',
        'destination',
        'comment',
        'html',
      ]) {
        const position = text.indexOf(`\\(${marker}\\)`);
        expect(position, marker).toBeGreaterThanOrEqual(0);
        expect(
          protectedNodes.some(
            (node) =>
              (node.position?.start.offset ?? Infinity) <= position &&
              (node.position?.end.offset ?? -1) >= position + marker.length + 4,
          ),
          marker,
        ).toBe(true);
      }
      const plain = text.indexOf(String.raw`\(plain\)`);
      expect(
        protectedNodes.some(
          (node) =>
            (node.position?.start.offset ?? Infinity) <= plain &&
            (node.position?.end.offset ?? -1) > plain,
        ),
      ).toBe(false);
      expect(
        nodes.some(
          (node) =>
            node.type === 'html' &&
            'value' in node &&
            node.value === ['<div>', String.raw`\(html\)`, '</div>'].join(newline),
        ),
      ).toBe(true);
    },
  );

  it('parses temporary replacement text without changing the input and tracks non-BMP offsets', () => {
    const original = '😀 before TARGET after';
    const from = original.indexOf('TARGET');
    const temporary =
      original.slice(0, from) + '`' + String.raw`\(x\)` + '`' + original.slice(from + 6);
    const node = flatten(fromMarkdown(temporary)).find((node) => node.type === 'inlineCode');
    expect(node?.position?.start.offset).toBe(from);
    expect(node?.position?.end.offset).toBe(from + 7);
    expect(original).toBe('😀 before TARGET after');
  });

  it('covers a 1 MB document through the final off-screen code block', () => {
    const text = largeFixture(1_000_000);
    const tree = fromMarkdown(text);
    expect(tree.position?.end.offset).toBe(text.length);
    const last = tree.children[tree.children.length - 1];
    expect(last?.type).toBe('code');
    expect(last && 'value' in last ? last.value : undefined).toBe('TAIL-CODE');
  }, 15_000);
});
