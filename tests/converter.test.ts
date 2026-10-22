import { describe, expect, it } from 'vitest';
import { applyEdits, mapOffset, mapSelection, planConversion, planPaste } from '../src/converter';
import {
  MAX_DOCUMENT_LENGTH,
  MAX_LINE_LENGTH,
  MAX_STRUCTURE_MARKERS,
  protectedRanges,
} from '../src/context';

const convert = (text: string) => applyEdits(text, planConversion(text).edits);
const raw = String.raw;

describe('T01–T07: delimiter-only conversion', () => {
  it.each([
    [raw`\(x^2 + y^2\)`, '$x^2 + y^2$'],
    [raw`\[E = mc^2\]`, '$$E = mc^2$$'],
    [raw`由 \(a\) 和 \(b\) 可得。`, '由 $a$ 和 $b$ 可得。'],
    [raw`😀 \(\frac{a}{b} + \bar X\)！`, raw`😀 $\frac{a}{b} + \bar X$！`],
    [raw`\(  x  \)`, '$  x  $'],
    [raw`\(a\) / \[b\] / \(c\)`, '$a$ / $$b$$ / $c$'],
    [raw`普通括号 (a) [b] 与 $5、$10。`, raw`普通括号 (a) [b] 与 $5、$10。`],
    [raw`\(x + 1`, raw`\(x + 1`],
    [raw`x + 1\)`, raw`x + 1\)`],
    [raw`\(a \$ b\)`, raw`$a \$ b$`],
    [raw`\(x<y\)`, '$x<y$'],
  ])('%s', (input, expected) => {
    expect(convert(input)).toBe(expected);
    expect(convert(expected)).toBe(expected);
  });

  it.each(['\n', '\r\n', '\r'])(
    'T07: preserves every body code unit and %j newlines',
    (newline) => {
      const body = `${newline}\\boxed{\\bar X\\approx N\\left(\\mu,\\frac{\\sigma^2}{n}\\right)}  😀${newline}`;
      const input = `前言${newline}\\[${body}\\]${newline}尾声`;
      const plan = planConversion(input);
      expect(plan.convertedCount).toBe(1);
      expect(plan.edits.map((edit) => input.slice(edit.from, edit.to))).toEqual([raw`\[`, raw`\]`]);
      expect(applyEdits(input, plan.edits)).toBe(`前言${newline}$$${body}$$${newline}尾声`);
    },
  );

  it('returns only the two delimiters for each formula', () => {
    const text = raw`前 \(x\) 后 \[y\]`;
    const result = planConversion(text);
    expect(result.status).toBe('converted');
    expect(result.convertedCount).toBe(2);
    expect(result.edits).toEqual([
      { from: 2, to: 4, insert: '$' },
      { from: 5, to: 7, insert: '$' },
      { from: 10, to: 12, insert: '$$' },
      { from: 13, to: 15, insert: '$$' },
    ]);
  });
});

describe('T08–T11: full-document protection', () => {
  const unchanged = [
    '`' + raw`\(x\)` + '`',
    '``' + raw`\(x\)` + ' ` more``',
    '```text\n' + raw`\(x\)` + '\n```',
    '~~~~text\n' + raw`\[x\]` + '\n~~~~',
    '```\n' + raw`\(unclosed-fence\)`,
    '    ' + raw`\(indented\)`,
    '\t' + raw`\(tab-code\)`,
    '> ```\n> ' + raw`\(quoted\)` + '\n> ```',
    '- item\n\n      ' + raw`\(list-code\)`,
    raw`$a + \(x\)$`,
    '$$\n' + raw`a + \[x\]` + '\n$$',
    raw`$$a + \(x\)$$`,
    '$a\n' + raw`\(existing-multiline\)` + '\nb$',
    '---\nvalue: ' + raw`\(yaml\)` + '\n---',
    '\uFEFF---\r\nvalue: ' + raw`\(yaml\)` + '\r\n---',
    '---\nvalue: ' + raw`\(unclosed-yaml\)`,
    raw`[\(label\)](https://example.invalid/\(target\))`,
    raw`![\(alt\)](image.png)`,
    raw`[label]: https://example.invalid/\(target\)`,
    raw`[\(label\)][reference]` + '\n\n[reference]: https://example.invalid',
    '<div>\n' + raw`\(html\)` + '\n</div>',
    raw`<span>\(html\)</span> and \(same-block\)`,
    raw`<!-- \(comment\) -->`,
    raw`<!-- unclosed \(comment\)`,
    raw`<span title="unclosed \(attribute\)`,
    raw`[[page|\(wiki\)]]`,
    raw`![[page#\(heading\)]]`,
    raw`[[unclosed \(wiki\)`,
    raw`%% \(comment\) %%`,
    raw`%% unclosed \(comment\)`,
    '`unclosed ' + raw`\(code\)`,
    raw`[broken](https://example.invalid/\(target\)`,
    raw`$unclosed \(x\)`,
    raw`$$ unclosed \(x\)`,
    raw`$$$ ambiguous \(x\)`,
  ];
  it.each(unchanged)('keeps %s', (input) => {
    expect(planConversion(input).edits).toEqual([]);
    expect(convert(input)).toBe(input);
  });

  it('converts safe text alongside protected inline code and existing math', () => {
    const input = raw`前 \(a\) ` + '`' + raw`\(code\)` + '`' + raw` $\(math\)$ 后 \[b\]`;
    expect(convert(input)).toBe(
      raw`前 $a$ ` + '`' + raw`\(code\)` + '`' + raw` $\(math\)$ 后 $$b$$`,
    );
  });

  it('leaves quoted/list code intact and converts later prose', () => {
    const input =
      '> ~~~\n> ' +
      raw`\(code\)` +
      '\n> ~~~\n\n- item\n\n      ' +
      raw`\(code\)` +
      '\n\n' +
      raw`\(safe\)`;
    expect(convert(input)).toBe(input.replace(raw`\(safe\)`, '$safe$'));
  });

  it('does not pair delimiters across protected content', () => {
    expect(convert(raw`\(a ` + '`code`' + raw` b\)`)).toBe(raw`\(a ` + '`code`' + raw` b\)`);
  });

  it('resumes conversion after a closed Obsidian comment or wiki link', () => {
    const input = raw`%% \(hidden\) %% [[\(link\)]] \(safe\)`;
    expect(convert(input)).toBe(raw`%% \(hidden\) %% [[\(link\)]] $safe$`);
  });

  it('resumes after an ambiguous single dollar line', () => {
    expect(convert(raw`$5 \(ambiguous\)` + '\n\n' + raw`\(safe\)`)).toBe(
      raw`$5 \(ambiguous\)` + '\n\n$safe$',
    );
  });
});

describe('T12–T13: conservative pairing and idempotence', () => {
  it.each([
    raw`\(\)`,
    raw`\[ \]`,
    raw`\(a \(b\) c\)`,
    raw`\[a \(b\) c\]`,
    raw`\(a \[b\) c\]`,
    raw`\[a \(b\] c\)`,
    raw`\\(x\\)`,
    raw`\\\(x\)`,
    raw`\(x\\)`,
    raw`\(a\)\(b\)`,
    raw`\[a\]\(b\)`,
    raw`\(a\)$`,
    raw`$\(a\)`,
    raw`\(a $ b\)`,
    raw`\[a $$ b\]`,
    raw`\(a \\$ b\)`,
    '\\(a\nb\\)',
    '\\(a\r\nb\\)',
  ])('preserves ambiguity: %s', (input) => {
    expect(convert(input)).toBe(input);
  });

  it('recovers after a closed invalid group', () => {
    const prefix = raw`\(a \[b\) c\]`;
    expect(convert(prefix + raw` then \(safe\)`)).toBe(prefix + ' then $safe$');
  });

  it('recovers on the next line after an unclosed inline formula', () => {
    expect(convert(raw`\(unfinished` + '\n' + raw`\(safe\)`)).toBe(raw`\(unfinished` + '\n$safe$');
  });

  it('retains an unclosed display suffix and converts a preceding formula', () => {
    expect(convert(raw`\(safe\) \[unfinished \(ambiguous\)`)).toBe(
      raw`$safe$ \[unfinished \(ambiguous\)`,
    );
  });

  it('remains idempotent across varied mixed documents', () => {
    for (const separator of [' ', '\n', '\r\n', '😀', ' / ']) {
      const text = [
        raw`\(a\)`,
        '`' + raw`\(code\)` + '`',
        raw`\[b\]`,
        raw`\(\)`,
        raw`\\(escaped\\)`,
      ].join(separator);
      expect(convert(convert(text))).toBe(convert(text));
    }
  });

  it('keeps deterministic combinations of safe and ambiguous fragments idempotent', () => {
    const fragments = [
      raw`\(x\)`,
      raw`\[y\]`,
      raw`\(`,
      raw`\)`,
      raw`\[`,
      raw`\]`,
      ' ',
      '\n',
      '$',
      '$$',
      '`code`',
      raw`\\(`,
      '%%',
      '[[',
      ']]',
      '<span>',
    ];
    let seed = 7421;
    for (let sample = 0; sample < 600; sample++) {
      let text = '';
      for (let i = 0; i < 10; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        text += fragments[(seed >>> 16) % fragments.length];
      }
      const once = convert(text);
      expect(convert(once), text).toBe(once);
    }
  });
});

describe('T14–T15: selection and no edits', () => {
  it('converts only formulas fully inside the target', () => {
    const text = raw`\(first\) \(second\)`;
    expect(applyEdits(text, planConversion(text, { from: 10, to: text.length }).edits)).toBe(
      raw`\(first\) $second$`,
    );
    expect(planConversion(text, { from: 1, to: 8 }).edits).toEqual([]);
  });

  it('uses external code/math context for a partial selection', () => {
    for (const text of [
      '```\n' + raw`\(x\)` + '\n```',
      raw`$a \(x\) b$`,
      raw`\[outside \(x\) outside\]`,
    ]) {
      const from = text.indexOf(raw`\(x\)`);
      expect(planConversion(text, { from, to: from + 5 }).edits).toEqual([]);
    }
  });

  it.each(['', '中文 😀 $5', 'just text'])('returns no modifications for %j', (text) => {
    expect(planConversion(text)).toEqual({ status: 'unchanged', edits: [], convertedCount: 0 });
  });

  it('does not edit an empty target', () => {
    expect(planConversion(raw`\(x\)`, { from: 0, to: 0 }).edits).toEqual([]);
  });

  it('rejects invalid ranges and unordered or overlapping edits', () => {
    for (const target of [
      { from: -1, to: 1 },
      { from: 2, to: 1 },
      { from: 0, to: 100 },
      { from: 0.5, to: 1 },
    ]) {
      expect(() => planConversion('text', target)).toThrow(RangeError);
    }
    expect(() =>
      applyEdits('abcdef', [
        { from: 1, to: 4, insert: '' },
        { from: 2, to: 5, insert: '' },
      ]),
    ).toThrow(RangeError);
  });
});

describe('position mapping in original UTF-16 coordinates', () => {
  it('maps forward, backward and collapsed selections without moving body offsets incorrectly', () => {
    const text = raw`😀 \(abc\) end`;
    const { edits } = planConversion(text);
    expect(mapSelection({ anchor: 3, head: 12 }, edits)).toEqual({ anchor: 3, head: 10 });
    expect(mapSelection({ anchor: 12, head: 3 }, edits)).toEqual({ anchor: 10, head: 3 });
    expect(mapSelection({ anchor: 7, head: 7 }, edits)).toEqual({ anchor: 6, head: 6 });
    expect(mapOffset(4, edits, -1)).toBe(3);
    expect(mapOffset(4, edits, 1)).toBe(4);
    expect(mapOffset(text.length, edits)).toBe(convert(text).length);
  });

  it('maps insertion boundary association', () => {
    const edits = [{ from: 2, to: 2, insert: 'abc' }];
    expect(mapOffset(2, edits, -1)).toBe(2);
    expect(mapOffset(2, edits, 1)).toBe(5);
  });
});

describe('pure paste planning for later host integration', () => {
  it('returns one replacement, converted payload and final cursor', () => {
    const result = planPaste('😀 before OLD after', { from: 10, to: 13 }, raw`\(x\) / \[y\]`);
    expect(result.status).toBe('converted');
    expect(result.convertedCount).toBe(2);
    expect(result.edits).toEqual([{ from: 10, to: 13, insert: '$x$ / $$y$$' }]);
    expect(result.selection).toEqual({ anchor: 21, head: 21 });
    expect(applyEdits('😀 before OLD after', result.edits)).toBe('😀 before $x$ / $$y$$ after');
  });

  it('does not complete a formula using characters outside the payload', () => {
    expect(planPaste(raw`\(before `, { from: 9, to: 9 }, raw`x\)`).edits).toEqual([]);
    expect(planPaste(raw`after\)`, { from: 0, to: 0 }, raw`\(x`).edits).toEqual([]);
  });

  it('respects original protected context even if inserted text closes the code fence', () => {
    const text = '```\nHERE\n```';
    expect(planPaste(text, { from: 4, to: 8 }, '\n```\n' + raw`\(x\)` + '\n```\n').status).toBe(
      'unsafe-context',
    );
  });

  it('examines the tentative document, including surrounding backticks', () => {
    expect(planPaste('`HERE`', { from: 1, to: 5 }, raw`\(x\)`).edits).toEqual([]);
    expect(planPaste('plain ', { from: 6, to: 6 }, '```\n' + raw`\(x\)` + '\n```').edits).toEqual(
      [],
    );
  });

  it('does not change formulas outside the paste range', () => {
    const text = raw`\(outside\) target`;
    const result = planPaste(text, { from: 12, to: text.length }, raw`\(inside\)`);
    expect(applyEdits(text, result.edits)).toBe(raw`\(outside\) $inside$`);
  });

  it('leaves no-match handling to default paste', () => {
    expect(planPaste('text', { from: 0, to: 4 }, 'ordinary')).toEqual({
      status: 'unchanged',
      edits: [],
      convertedCount: 0,
    });
  });
});

describe('bounded work and safe fallback', () => {
  it('rejects a 1 MB mixed document without parsing a truncated prefix', () => {
    const text = (raw`\(x\)` + '\n').repeat(170_000);
    expect(planConversion(text)).toEqual({ status: 'too-large', edits: [], convertedCount: 0 });
    expect(planConversion(text, { from: 0, to: 5 }).status).toBe('too-large');
  });

  it('enforces document, line and markup budgets', () => {
    expect(protectedRanges('x'.repeat(MAX_DOCUMENT_LENGTH + 1)).status).toBe('too-large');
    expect(planConversion('x'.repeat(MAX_LINE_LENGTH + 1) + raw`\(x\)`).status).toBe('too-large');
    expect(
      planConversion(
        ('[]'.repeat(100) + '\n').repeat(Math.ceil(MAX_STRUCTURE_MARKERS / 200) + 1) + raw`\(x\)`,
      ).status,
    ).toBe('too-large');
    expect(
      planPaste('', { from: 0, to: 0 }, 'x'.repeat(MAX_DOCUMENT_LENGTH) + raw`\(x\)`).status,
    ).toBe('too-large');
  });

  it('converts a roughly 10 KB mixed document within the supported budget', () => {
    const line = raw`paragraph \(x\) ` + '`code`\n\n';
    const text = line.repeat(400);
    const result = planConversion(text);
    expect(result.status).toBe('converted');
    expect(result.convertedCount).toBe(400);
    expect(convert(convert(text))).toBe(convert(text));
  });
});
