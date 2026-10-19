// Synthetic notes only. These fixtures are never taken from a user's vault.
export const MARKER = 'MathPaste isolated P1 probe v1';
export const PASTE_INPUT = String.raw`P1 \(x\)`;
export const PASTE_OUTPUT = 'P1 $x$';

export const PARSER_FIXTURE = [
  '---',
  String.raw`property: \(yaml\)`,
  '---',
  '',
  String.raw`normal \(plain\)`,
  '',
  String.raw`inline: ` + '`' + String.raw`\(code\)` + '`',
  '',
  '```text',
  String.raw`\(fenced\)`,
  '```',
  '',
  '~~~text',
  String.raw`\(tilde\)`,
  '~~~',
  '',
  String.raw`    \(indented\)`,
  '',
  '> ```',
  String.raw`> \(quoted\)`,
  '> ```',
  '',
  '- item',
  '',
  String.raw`      \(list-code\)`,
  '',
  String.raw`$a + \(existing-inline\)$`,
  '',
  '$$',
  String.raw`b + \[existing-display\]`,
  '$$',
  '',
  String.raw`[label](https://example.invalid/\(destination\))`,
  '',
  String.raw`<!-- \(comment\) -->`,
  '',
  '<div>',
  String.raw`\(html\)`,
  '</div>',
  '',
  String.raw`tail \[last\]`,
].join('\n');

export function largeFixture(size: number): string {
  const line = String.raw`paragraph \(x\) ` + '`code`\n\n';
  return line.repeat(Math.ceil(size / line.length)) + '\n```\nTAIL-CODE\n```';
}
