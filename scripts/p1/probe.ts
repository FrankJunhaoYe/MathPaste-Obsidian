import { isolateHistory } from '@codemirror/commands';
import { ensureSyntaxTree, syntaxTree, syntaxTreeAvailable } from '@codemirror/language';
import { EditorSelection, Transaction, type EditorState } from '@codemirror/state';
import { ViewPlugin, type EditorView } from '@codemirror/view';
import {
  Plugin,
  MarkdownView,
  Notice,
  apiVersion,
  editorInfoField,
  editorLivePreviewField,
  type Editor,
} from 'obsidian';
import { MARKER, PARSER_FIXTURE, PASTE_INPUT, PASTE_OUTPUT, largeFixture } from './fixtures';

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function snapshot(state: EditorState, detailed = true) {
  const availableBefore = syntaxTreeAvailable(state, state.doc.length);
  const beforeLength = syntaxTree(state).length;
  const start = performance.now();
  const tree = ensureSyntaxTree(state, state.doc.length, 100);
  const elapsedMs = Math.round((performance.now() - start) * 100) / 100;
  const nodes: { name: string; from: number; to: number }[] = [];
  const counts: Record<string, number> = {};
  tree?.iterate({
    enter(node) {
      counts[node.name] = (counts[node.name] ?? 0) + 1;
      if (detailed) nodes.push({ name: node.name, from: node.from, to: node.to });
    },
  });
  return {
    length: state.doc.length,
    beforeLength,
    availableBefore,
    complete: tree !== null,
    treeLength: tree?.length ?? null,
    elapsedMs,
    counts,
    nodes,
  };
}

// A separate developer-only plugin. The production src/main.ts never imports this file.
export default class P1Probe extends Plugin {
  private views = new Set<EditorView>();
  private report: Record<string, unknown> = {};
  private enabled = false;
  private disposed = false;

  async onload() {
    const marker = 'mathpaste-p1-marker.json';
    if (!(await this.app.vault.adapter.exists(marker))) return;
    const data = JSON.parse(await this.app.vault.adapter.read(marker)) as { purpose?: string };
    if (data.purpose !== MARKER) return;
    this.enabled = true;
    const views = this.views;
    this.registerEditorExtension(
      ViewPlugin.fromClass(
        class {
          constructor(readonly view: EditorView) {
            views.add(view);
          }
          destroy() {
            views.delete(this.view);
          }
        },
      ),
    );
    this.registerEvent(
      this.app.workspace.on('editor-paste', (event, editor, info) => {
        if (!this.enabled || event.defaultPrevented || info.file?.path !== 'P1-paste.md') return;
        // Read only the known synthetic fixture in this marked test vault. Never persist clipboard text.
        if (
          event.clipboardData?.files.length ||
          event.clipboardData?.getData('text/plain') !== PASTE_INPUT
        )
          return;
        const view = this.findView(editor);
        if (!view || editor.listSelections().length !== 1) return;
        const before = editor.getValue();
        const selection = view.state.selection.toJSON();
        const { from, to } = view.state.selection.main;
        event.preventDefault();
        view.dispatch({
          changes: { from, to, insert: PASTE_OUTPUT },
          selection: { anchor: from + PASTE_OUTPUT.length },
          annotations: [isolateHistory.of('full'), Transaction.userEvent.of('input.paste')],
        });
        const after = editor.getValue();
        editor.undo();
        const undoRestored = editor.getValue() === before;
        const undoSelectionRestored =
          JSON.stringify(view.state.selection.toJSON()) === JSON.stringify(selection);
        editor.redo();
        this.report['paste'] = {
          trusted: event.isTrusted,
          defaultPrevented: event.defaultPrevented,
          replacedExactlyOnce: after === before.slice(0, from) + PASTE_OUTPUT + before.slice(to),
          undoRestored,
          undoSelectionRestored,
          redoRestored: editor.getValue() === after,
          cursorMapped: view.state.selection.main.head === from + PASTE_OUTPUT.length,
        };
        void this.save();
        new Notice('P1 paste probe recorded');
      }),
    );
    this.app.workspace.onLayoutReady(() => {
      void this.run().catch(async (error: unknown) => {
        this.report['error'] = String(error);
        await this.save();
        new Notice('P1 probe failed; inspect p1-report.json');
      });
    });
  }

  onunload() {
    this.enabled = false;
    this.disposed = true;
    this.views.clear();
  }

  private findView(editor: Editor) {
    return [...this.views].find(
      (view) => view.state.field(editorInfoField, false)?.editor === editor,
    );
  }

  private async save() {
    if (!this.disposed)
      await this.app.vault.adapter.write('p1-report.json', JSON.stringify(this.report, null, 2));
  }

  private async run() {
    if (!this.enabled || this.disposed) return;
    if (await this.app.vault.adapter.exists('p1-report.json')) {
      this.report = JSON.parse(await this.app.vault.adapter.read('p1-report.json')) as Record<
        string,
        unknown
      >;
      new Notice('P1: previous report preserved; prepare a NEW vault to repeat the full run');
      return;
    }
    const file = await this.app.vault.create('P1-parser.md', PARSER_FIXTURE);
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, { state: { mode: 'source' } });
    const markdown = leaf.view;
    if (!(markdown instanceof MarkdownView)) throw new Error('No MarkdownView');
    const editor = markdown.editor;
    let view = this.findView(editor);
    for (let i = 0; !view && i < 20 && !this.disposed; i++) {
      await pause(100);
      view = this.findView(editor);
    }
    if (!view || this.disposed) throw new Error('No public editorInfoField mapping');
    this.report = {
      apiVersion,
      userAgent: navigator.userAgent,
      livePreview: view.state.field(editorLivePreviewField, false),
      parser: snapshot(view.state),
    };
    const original = view.state.doc.toString();
    const insert = '\n```\nTEMP-CODE\n```\n';
    const temporary = view.state.update({
      changes: { from: original.length, insert },
      filter: false,
    }).state;
    this.report['temporary'] = {
      ...snapshot(temporary),
      originalUnchanged: view.state.doc.toString() === original,
      expectedDocument: temporary.doc.toString() === original + insert,
    };

    for (const size of [10_000, 1_000_000]) {
      editor.setValue(largeFixture(size));
      this.report[`size${size}`] = snapshot(view.state, false);
    }

    editor.setValue(String.raw`prior \(x\)`);
    editor.replaceRange('A', { line: 0, ch: 0 }, undefined, '+input');
    const before = editor.getValue();
    editor.transaction(
      {
        changes: [
          { from: { line: 0, ch: 7 }, to: { line: 0, ch: 9 }, text: '$' },
          { from: { line: 0, ch: 10 }, to: { line: 0, ch: 12 }, text: '$' },
        ],
        selection: { from: { line: 0, ch: 10 } },
      },
      'mathpaste-p1',
    );
    const after = editor.getValue();
    editor.undo();
    const undoRestored = editor.getValue() === before;
    editor.redo();
    this.report['editorTransaction'] = {
      expectedEdit: after === 'Aprior $x$',
      undoRestored,
      redoRestored: editor.getValue() === after,
    };

    editor.setValue(String.raw`prior \(x\)`);
    view.dispatch({
      changes: { from: 0, insert: 'A' },
      annotations: Transaction.userEvent.of('input.type'),
    });
    const cmBefore = editor.getValue();
    view.dispatch({ selection: EditorSelection.single(7, 12) });
    const cmSelection = view.state.selection.toJSON();
    view.dispatch({
      changes: [
        { from: 7, to: 9, insert: '$' },
        { from: 10, to: 12, insert: '$' },
      ],
      selection: { anchor: 7, head: 10 },
      annotations: [isolateHistory.of('full'), Transaction.userEvent.of('input.mathpaste')],
    });
    const cmAfter = editor.getValue();
    editor.undo();
    this.report['isolatedTransaction'] = {
      expectedEdit: cmAfter === 'Aprior $x$',
      undoRestored: editor.getValue() === cmBefore,
      undoSelectionRestored:
        JSON.stringify(view.state.selection.toJSON()) === JSON.stringify(cmSelection),
    };
    editor.redo();
    this.report['isolatedRedo'] = {
      redoRestored: editor.getValue() === cmAfter,
      selectionMapped: view.state.selection.main.from === 7 && view.state.selection.main.to === 10,
    };

    view.dispatch({
      selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(5)]),
    });
    this.report['multipleSelections'] = {
      count: editor.listSelections().length,
      matchesPublicState: editor.listSelections().length === view.state.selection.ranges.length,
    };

    const pasteFile = await this.app.vault.create('P1-paste.md', `${PASTE_INPUT}\n\nPRIOR>`);
    await leaf.openFile(pasteFile, { state: { mode: 'source' } });
    await this.save();
    new Notice('P1 ready: copy first line and paste after PRIOR>');
  }
}
