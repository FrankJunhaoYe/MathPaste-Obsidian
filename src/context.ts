import { fromMarkdown } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { frontmatter } from 'micromark-extension-frontmatter';

export interface TextRange {
  readonly from: number;
  readonly to: number;
}
export const MAX_DOCUMENT_LENGTH = 32_768;
export const MAX_LINE_LENGTH = 2_048;
export const MAX_STRUCTURE_MARKERS = 2_048;

export type ContextResult =
  | { readonly status: 'ready'; readonly ranges: readonly TextRange[] }
  | { readonly status: 'too-large' | 'unsafe-context'; readonly ranges: readonly TextRange[] };

export function isEscaped(text: string, offset: number): boolean {
  let slashes = 0;
  for (let i = offset - 1; i >= 0 && text[i] === '\\'; i--) slashes++;
  return slashes % 2 === 1;
}

export function mergeRanges(ranges: readonly TextRange[]): TextRange[] {
  const result: TextRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.from - b.from || a.to - b.to)) {
    const previous = result[result.length - 1];
    if (previous && range.from <= previous.to) {
      result[result.length - 1] = { from: previous.from, to: Math.max(previous.to, range.to) };
    } else if (range.to > range.from) result.push(range);
  }
  return result;
}

export function exceedsBudget(text: string): boolean {
  if (text.length > MAX_DOCUMENT_LENGTH) return true;
  let lineLength = 0;
  let markers = 0;
  for (const char of text) {
    if (char === '\n' || char === '\r') lineLength = 0;
    else if ((lineLength += char.length) > MAX_LINE_LENGTH) return true;
    if ('[]`*_<>~|'.includes(char) && ++markers > MAX_STRUCTURE_MARKERS) return true;
  }
  return false;
}

// Only ranges are returned: no normalized AST text is used to reconstruct a note.
export function protectedRanges(text: string): ContextResult {
  if (exceedsBudget(text)) return { status: 'too-large', ranges: [] };
  try {
    const tree = fromMarkdown(text, {
      extensions: [frontmatter(['yaml'])],
      mdastExtensions: [frontmatterFromMarkdown(['yaml'])],
    });
    const ranges: TextRange[] = [];
    const blocks: TextRange[] = [];
    const protectedTypes = new Set([
      'code',
      'inlineCode',
      'yaml',
      'link',
      'image',
      'linkReference',
      'imageReference',
      'definition',
    ]);
    // Structural typing keeps the walk independent of optional AST augmentation packages.
    type Node = {
      type: string;
      position?:
        | { start: { offset?: number | undefined }; end: { offset?: number | undefined } }
        | undefined;
      children?: Node[] | undefined;
    };
    const pending: { node: Node; block: TextRange | undefined }[] = [
      { node: tree, block: undefined },
    ];
    while (pending.length) {
      const entry = pending.pop();
      if (!entry) break;
      const { node } = entry;
      const from = node.position?.start.offset;
      const to = node.position?.end.offset;
      if (from === undefined || to === undefined) return { status: 'unsafe-context', ranges: [] };
      const range = { from, to };
      const block = ['paragraph', 'heading', 'tableCell'].includes(node.type) ? range : entry.block;
      if (block === range) blocks.push(range);
      if (node.type === 'html') {
        ranges.push(block ?? range);
        continue;
      }
      if (protectedTypes.has(node.type)) {
        ranges.push(range);
        continue;
      }
      for (const child of node.children ?? []) pending.push({ node: child, block });
    }
    // Incomplete frontmatter must not become ordinary text just because the parser rejected it.
    if (/^\uFEFF?---[ \t]*(?:\r\n|\n|\r|$)/u.test(text) && tree.children[0]?.type !== 'yaml') {
      return { status: 'ready', ranges: [{ from: 0, to: text.length }] };
    }

    let merged = mergeRanges(ranges);
    // Supplemental Obsidian syntax and incomplete inline structures. CommonMark code/link/HTML
    // recognition stays with the independent parser; these guards intentionally overprotect.
    let rangeIndex = 0;
    const extra: TextRange[] = [];
    for (let i = 0; i < text.length; i++) {
      while (merged[rangeIndex] && merged[rangeIndex]!.to <= i) rangeIndex++;
      const protectedRange = merged[rangeIndex];
      if (protectedRange && protectedRange.from <= i) {
        i = protectedRange.to - 1;
        continue;
      }
      if (!'%[`]<'.includes(text[i] ?? '') || isEscaped(text, i)) continue;
      const opener = text.startsWith('%%', i) ? '%%' : text.startsWith('[[', i) ? ']]' : undefined;
      if (opener) {
        let end = text.indexOf(opener, i + 2);
        while (end >= 0 && isEscaped(text, end)) end = text.indexOf(opener, end + 2);
        const to = end < 0 ? text.length : end + 2;
        extra.push({ from: i, to });
        i = to - 1;
      } else if (
        text[i] === '`' ||
        text.startsWith('](', i) ||
        text.startsWith('][', i) ||
        (text[i] === '<' && /^\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>]|$)/u.test(text.slice(i + 1)))
      ) {
        const block = blocks.find((candidate) => candidate.from <= i && candidate.to > i);
        extra.push(block ?? { from: i, to: text.length });
      }
    }
    merged = mergeRanges([...merged, ...extra]);
    const mathRanges: TextRange[] = [];
    rangeIndex = 0;
    let opening: { from: number; width: number } | undefined;
    for (let i = 0; i < text.length; i++) {
      while (merged[rangeIndex] && merged[rangeIndex]!.to <= i) rangeIndex++;
      const protectedRange = merged[rangeIndex];
      if (protectedRange && protectedRange.from <= i) {
        i = protectedRange.to - 1;
        continue;
      }
      if (text[i] !== '$' || isEscaped(text, i)) continue;
      let end = i + 1;
      while (text[end] === '$') end++;
      const width = end - i;
      if (!opening) opening = { from: i, width };
      else if (width === opening.width) {
        mathRanges.push({ from: opening.from, to: end });
        opening = undefined;
      }
      i = end - 1;
    }
    if (opening) {
      const newline = opening.width === 1 ? text.slice(opening.from).search(/[\r\n]/u) : -1;
      mathRanges.push({
        from: opening.from,
        to: newline < 0 ? text.length : opening.from + newline,
      });
    }
    return { status: 'ready', ranges: mergeRanges([...merged, ...mathRanges]) };
  } catch {
    // Parser failure is a no-edit result, never permission to scan as unprotected text.
    return { status: 'unsafe-context', ranges: [] };
  }
}
