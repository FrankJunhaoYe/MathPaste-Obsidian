import { history, redo, undo } from '@codemirror/commands';
import { EditorSelection, EditorState, Transaction, type TransactionSpec } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { Editor } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { convertEditor, convertPaste } from '../src/editor';

function fixture(doc: string, from = 0, to = from) {
  let state = EditorState.create({
    doc,
    selection: { anchor: from, head: to },
    extensions: [history(), EditorState.allowMultipleSelections.of(true)],
  });
  const dispatch = vi.fn((spec: TransactionSpec | Transaction) => {
    state = spec instanceof Transaction ? spec.state : state.update(spec).state;
  });
  const view = {
    get state() {
      return state;
    },
    dispatch,
  } as unknown as EditorView;
  const editor = {
    getValue: () => state.doc.toString(),
    listSelections: () => state.selection.ranges,
  } as unknown as Editor;
  const change = (spec: TransactionSpec) => dispatch(spec);
  const stepUndo = () => undo({ state, dispatch });
  const stepRedo = () => redo({ state, dispatch });
  return { view, editor, dispatch, change, stepUndo, stepRedo, text: () => state.doc.toString() };
}

function paste(
  text: string,
  options: { prevented?: boolean; files?: boolean; fileItem?: boolean; noData?: boolean } = {},
) {
  let prevented = options.prevented ?? false;
  const getData = vi.fn((type: string) => (type === 'text/plain' ? text : '<b>HTML</b>'));
  const event = {
    get defaultPrevented() {
      return prevented;
    },
    clipboardData: options.noData
      ? null
      : {
          getData,
          files: options.files ? [{}] : [],
          items: options.fileItem ? [{ kind: 'file' }] : [{ kind: 'string' }],
        },
    preventDefault: vi.fn(() => {
      prevented = true;
    }),
  } as unknown as ClipboardEvent;
  return { event, getData };
}

describe('manual editor transactions', () => {
  it('converts current note in one isolated history event, retaining prior typing', () => {
    const f = fixture(String.raw`\(x\) then \[y\]`);
    f.change({
      changes: { from: 0, insert: 'prior ' },
      annotations: Transaction.userEvent.of('input.type'),
    });
    const before = f.text();
    f.dispatch.mockClear();
    expect(convertEditor(f.editor, f.view).convertedCount).toBe(2);
    expect(f.dispatch).toHaveBeenCalledTimes(1);
    expect(f.text()).toBe('prior $x$ then $$y$$');
    f.stepUndo();
    expect(f.text()).toBe(before);
    f.stepRedo();
    expect(f.text()).toBe('prior $x$ then $$y$$');
  });

  it('limits edits to the reverse selection and restores it on undo', () => {
    const text = String.raw`\(first\) \(second\)`;
    const f = fixture(text, text.length, 10);
    expect(convertEditor(f.editor, f.view).convertedCount).toBe(1);
    expect(f.text()).toBe(String.raw`\(first\) $second$`);
    expect(f.view.state.selection.main.anchor).toBe(text.length - 2);
    f.stepUndo();
    expect(f.text()).toBe(text);
    expect(f.view.state.selection.main.anchor).toBe(text.length);
    expect(f.view.state.selection.main.head).toBe(10);
  });

  it('does not dispatch on unchanged, protected, oversized or multiple selections', () => {
    for (const text of [
      'plain',
      '`' + String.raw`\(x\)` + '`',
      'x'.repeat(33_000) + String.raw`\(x\)`,
    ]) {
      const f = fixture(text);
      convertEditor(f.editor, f.view);
      expect(f.dispatch).not.toHaveBeenCalled();
    }
    const f = fixture(String.raw`\(x\)`);
    f.change({
      selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(2)]),
    });
    f.dispatch.mockClear();
    expect(convertEditor(f.editor, f.view).status).toBe('multiple-selections');
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it('does not use mismatched editor state', () => {
    const f = fixture(String.raw`\(x\)`);
    const stale = { ...f.editor, getValue: () => 'different' } as Editor;
    expect(convertEditor(stale, f.view).status).toBe('unavailable');
    expect(f.dispatch).not.toHaveBeenCalled();
  });
});

describe('paste transaction branches', () => {
  it('inserts converted plain text once, undoing only the paste and restoring selection', () => {
    const f = fixture('OLD', 0, 3);
    f.change({
      changes: { from: 3, insert: ' prior' },
      annotations: Transaction.userEvent.of('input.type'),
      selection: { anchor: 0, head: 3 },
    });
    const p = paste(String.raw`\(x\) and \[y\]`);
    f.dispatch.mockClear();
    expect(convertPaste(p.event, f.editor, f.view, true)).toBe(true);
    expect(f.dispatch).toHaveBeenCalledTimes(1);
    expect(f.text()).toBe('$x$ and $$y$$ prior');
    expect(p.event.defaultPrevented).toBe(true);
    expect(p.getData).toHaveBeenCalledWith('text/plain');
    expect(p.getData).toHaveBeenCalledTimes(1);
    f.stepUndo();
    expect(f.text()).toBe('OLD prior');
    expect(f.view.state.selection.main.to).toBe(3);
    f.stepRedo();
    expect(f.text()).toBe('$x$ and $$y$$ prior');
    expect(f.view.state.selection.main.head).toBe(13);
  });

  it.each([{ prevented: true }, { files: true }, { fileItem: true }, { noData: true }])(
    'does not intercept clipboard branch %j',
    (options) => {
      const f = fixture('');
      const p = paste(String.raw`\(x\)`, options);
      expect(convertPaste(p.event, f.editor, f.view, true)).toBe(false);
      expect(f.dispatch).not.toHaveBeenCalled();
      expect(p.getData).not.toHaveBeenCalled();
      expect(p.event.preventDefault).not.toHaveBeenCalled();
    },
  );

  it('does not access clipboard text when disabled or multi-cursor', () => {
    const f = fixture('plain');
    const p = paste(String.raw`\(x\)`);
    expect(convertPaste(p.event, f.editor, f.view, false)).toBe(false);
    f.change({
      selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(2)]),
    });
    f.dispatch.mockClear();
    expect(convertPaste(p.event, f.editor, f.view, true)).toBe(false);
    expect(p.getData).not.toHaveBeenCalled();
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it.each([
    'no match',
    String.raw`\(unclosed`,
    '```\n' + String.raw`\(code\)` + '\n```',
    'x'.repeat(33_000) + String.raw`\(x\)`,
  ])('keeps default behavior for %s', (text) => {
    const f = fixture('');
    const p = paste(text);
    expect(convertPaste(p.event, f.editor, f.view, true)).toBe(false);
    expect(f.dispatch).not.toHaveBeenCalled();
    expect(p.event.defaultPrevented).toBe(false);
  });

  it('keeps default behavior in existing code and math', () => {
    for (const text of ['`code`', '$math$']) {
      const f = fixture(text, 2);
      const p = paste(String.raw`\(x\)`);
      expect(convertPaste(p.event, f.editor, f.view, true)).toBe(false);
      expect(f.dispatch).not.toHaveBeenCalled();
      expect(p.event.defaultPrevented).toBe(false);
    }
  });
});
