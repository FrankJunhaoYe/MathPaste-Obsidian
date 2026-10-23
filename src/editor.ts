import { isolateHistory } from '@codemirror/commands';
import { Transaction } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { Editor } from 'obsidian';
import { mapSelection, planConversion, planPaste, type ConversionPlan } from './converter';

export interface EditorResult {
  readonly status: ConversionPlan['status'] | 'multiple-selections' | 'unavailable';
  readonly convertedCount: number;
}

function ready(editor: Editor, view: EditorView): boolean {
  return editor.getValue() === view.state.doc.toString();
}

export function convertEditor(editor: Editor, view: EditorView): EditorResult {
  if (editor.listSelections().length !== 1 || view.state.selection.ranges.length !== 1) {
    return { status: 'multiple-selections', convertedCount: 0 };
  }
  if (!ready(editor, view)) return { status: 'unavailable', convertedCount: 0 };
  const initial = view.state;
  const text = initial.doc.toString();
  const selection = initial.selection.main;
  const result = planConversion(text, selection.empty ? { from: 0, to: text.length } : selection);
  if (result.status !== 'converted') return result;
  if (view.state !== initial) return { status: 'unavailable', convertedCount: 0 };
  view.dispatch({
    changes: result.edits,
    selection: mapSelection(selection, result.edits),
    annotations: [isolateHistory.of('full'), Transaction.userEvent.of('input.mathpaste')],
  });
  return result;
}

export function convertPaste(
  event: ClipboardEvent,
  editor: Editor,
  view: EditorView,
  enabled: boolean,
): boolean {
  if (
    !enabled ||
    event.defaultPrevented ||
    !event.clipboardData ||
    event.clipboardData.files.length > 0 ||
    Array.from(event.clipboardData.items).some((item) => item.kind === 'file') ||
    editor.listSelections().length !== 1 ||
    view.state.selection.ranges.length !== 1 ||
    !ready(editor, view)
  )
    return false;
  const inserted = event.clipboardData.getData('text/plain');
  const initial = view.state;
  const result = planPaste(initial.doc.toString(), initial.selection.main, inserted);
  if (result.status !== 'converted' || view.state !== initial || !result.selection) return false;
  view.dispatch({
    changes: result.edits,
    selection: result.selection,
    annotations: [isolateHistory.of('full'), Transaction.userEvent.of('input.paste')],
  });
  event.preventDefault();
  return true;
}

export function resultMessage(result: EditorResult): string {
  switch (result.status) {
    case 'converted':
      return `已转换 ${result.convertedCount} 组公式`;
    case 'unchanged':
      return '未找到可安全转换的完整公式';
    case 'too-large':
      return '文本超过处理上限（全文 32768、单行 2048、结构标记 2048），未作修改';
    case 'multiple-selections':
      return 'MathPaste 目前仅支持单选区';
    case 'unsafe-context':
      return '无法可靠识别文本上下文，未作修改';
    case 'unavailable':
      return '编辑器状态暂不可用，未作修改';
  }
}
