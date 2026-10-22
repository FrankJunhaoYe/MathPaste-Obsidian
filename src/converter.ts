import {
  MAX_DOCUMENT_LENGTH,
  exceedsBudget,
  isEscaped,
  protectedRanges,
  type TextRange,
} from './context';

export interface TextEdit extends TextRange {
  readonly insert: string;
}
export interface Selection {
  readonly anchor: number;
  readonly head: number;
}
export interface ConversionPlan {
  readonly status: 'converted' | 'unchanged' | 'too-large' | 'unsafe-context';
  readonly edits: readonly TextEdit[];
  readonly convertedCount: number;
}

function empty(status: ConversionPlan['status'] = 'unchanged'): ConversionPlan {
  return { status, edits: [], convertedCount: 0 };
}

function validateRange(range: TextRange, length: number) {
  if (
    !Number.isInteger(range.from) ||
    !Number.isInteger(range.to) ||
    range.from < 0 ||
    range.to < range.from ||
    range.to > length
  ) {
    throw new RangeError('Range must use ordered UTF-16 offsets within the document');
  }
}

interface Delimiter extends TextRange {
  kind: string;
  repeated: boolean;
}

export function planConversion(
  text: string,
  target: TextRange = { from: 0, to: text.length },
): ConversionPlan {
  validateRange(target, text.length);
  if (target.from === target.to || (!text.includes('\\(') && !text.includes('\\['))) return empty();
  const context = protectedRanges(text);
  if (context.status !== 'ready') return empty(context.status);
  const candidates: { open: Delimiter; close: Delimiter }[] = [];
  const stack: Delimiter[] = [];
  let invalid = false;
  let rangeIndex = 0;
  for (let i = 0; i < text.length; i++) {
    while (context.ranges[rangeIndex] && context.ranges[rangeIndex]!.to <= i) rangeIndex++;
    const protectedRange = context.ranges[rangeIndex];
    if (protectedRange && protectedRange.from <= i) {
      if (stack.length) invalid = true;
      i = protectedRange.to - 1;
      continue;
    }
    if ((text[i] === '\r' || text[i] === '\n') && stack[0]?.kind === '(') {
      stack.length = 0;
      invalid = false;
    }
    if (text[i] !== '\\') continue;
    let end = i + 1;
    while (text[end] === '\\') end++;
    const kind = text[end];
    if (!kind || !'()[]'.includes(kind)) {
      i = end - 1;
      continue;
    }
    const token = { from: i, to: end + 1, kind, repeated: end - i !== 1 };
    i = end;
    if (kind === '(' || kind === '[') {
      if (stack.length) invalid = true;
      else invalid = false;
      invalid ||= token.repeated;
      stack.push(token);
    } else {
      const opening = stack.pop();
      if (!opening) continue;
      invalid ||= token.repeated || (opening.kind === '(' ? kind !== ')' : kind !== ']');
      if (stack.length === 0 && !invalid) candidates.push({ open: opening, close: token });
    }
  }

  const edits: TextEdit[] = [];
  for (let index = 0; index < candidates.length; index++) {
    const pair = candidates[index];
    if (!pair) continue;
    const { open, close } = pair;
    if (open.from < target.from || close.to > target.to) continue;
    if (
      text[open.from - 1] === '$' ||
      text[close.to] === '$' ||
      candidates[index - 1]?.close.to === open.from ||
      candidates[index + 1]?.open.from === close.to
    )
      continue;
    const body = text.slice(open.to, close.from);
    if (!body.trim() || (open.kind === '(' && /[\r\n]/u.test(body))) continue;
    let dollar = false;
    for (let i = open.to; i < close.from; i++)
      if (text[i] === '$' && !isEscaped(text, i)) {
        dollar = true;
        break;
      }
    if (dollar) continue;
    const insert = open.kind === '(' ? '$' : '$$';
    edits.push(
      { from: open.from, to: open.to, insert },
      { from: close.from, to: close.to, insert },
    );
  }
  return edits.length ? { status: 'converted', edits, convertedCount: edits.length / 2 } : empty();
}

export function applyEdits(text: string, edits: readonly TextEdit[]): string {
  const pieces: string[] = [];
  let position = 0;
  for (const edit of edits) {
    validateRange(edit, text.length);
    if (edit.from < position) throw new RangeError('Edits must be ordered and nonoverlapping');
    pieces.push(text.slice(position, edit.from), edit.insert);
    position = edit.to;
  }
  pieces.push(text.slice(position));
  return pieces.join('');
}

export function mapOffset(
  offset: number,
  edits: readonly TextEdit[],
  association: -1 | 1 = 1,
): number {
  let delta = 0;
  for (const edit of edits) {
    if (offset < edit.from) break;
    if (offset < edit.to || (offset === edit.from && association === -1)) {
      return edit.from + delta + (association === 1 ? edit.insert.length : 0);
    }
    delta += edit.insert.length - (edit.to - edit.from);
  }
  return offset + delta;
}

export function mapSelection(selection: Selection, edits: readonly TextEdit[]): Selection {
  const forward = selection.anchor < selection.head;
  return {
    anchor: mapOffset(selection.anchor, edits, forward ? -1 : 1),
    head: mapOffset(selection.head, edits, selection.anchor > selection.head ? -1 : 1),
  };
}

export interface PastePlan extends ConversionPlan {
  readonly selection?: Selection;
}

export function planPaste(text: string, target: TextRange, inserted: string): PastePlan {
  validateRange(target, text.length);
  if (!inserted.includes('\\(') && !inserted.includes('\\[')) return empty();
  if (
    exceedsBudget(text) ||
    text.length - (target.to - target.from) + inserted.length > MAX_DOCUMENT_LENGTH
  )
    return empty('too-large');
  const original = protectedRanges(text);
  if (original.status !== 'ready') return empty(original.status);
  if (original.ranges.some((range) => range.from <= target.to && range.to >= target.from))
    return empty('unsafe-context');
  const temporary = text.slice(0, target.from) + inserted + text.slice(target.to);
  const result = planConversion(temporary, {
    from: target.from,
    to: target.from + inserted.length,
  });
  if (result.status !== 'converted') return result;
  const localEdits = result.edits.map((edit) => ({
    ...edit,
    from: edit.from - target.from,
    to: edit.to - target.from,
  }));
  const insert = applyEdits(inserted, localEdits);
  const cursor = target.from + insert.length;
  return {
    status: 'converted',
    convertedCount: result.convertedCount,
    edits: [{ ...target, insert }],
    selection: { anchor: cursor, head: cursor },
  };
}
