import { ViewPlugin, type EditorView } from '@codemirror/view';
import { EditorSelection } from '@codemirror/state';
import { undoDepth } from '@codemirror/commands';
import {
  Plugin,
  MarkdownView,
  editorInfoField,
  editorLivePreviewField,
  apiVersion,
} from 'obsidian';
import { convertEditor } from '../src/editor';

// Developer-only, synthetic fixtures in the explicitly marked P1 test vault.
export default class HostProbe extends Plugin {
  private views = new Set<EditorView>();
  private cancelled = false;

  async onload() {
    const marker = 'mathpaste-p1-marker.json';
    if (
      !(await this.app.vault.adapter.exists(marker)) ||
      (JSON.parse(await this.app.vault.adapter.read(marker)) as { purpose: string }).purpose !==
        'MathPaste isolated P1 probe v1'
    )
      return;
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
    this.app.workspace.onLayoutReady(() => {
      void this.run();
    });
  }

  onunload() {
    this.cancelled = true;
    this.views.clear();
  }

  private async run() {
    const config = '.obsidian/plugins/mathpaste/data.json';
    const enabled =
      !(await this.app.vault.adapter.exists(config)) ||
      (JSON.parse(await this.app.vault.adapter.read(config)) as { autoConvertPaste: boolean })
        .autoConvertPaste !== false;
    const output = `mathpaste-host-${enabled ? 'enabled' : 'disabled'}.json`;
    if (await this.app.vault.adapter.exists(output)) return;
    const report: Record<string, unknown> = {
      apiVersion,
      autoConvertPaste: enabled,
      syntheticPaste: true,
    };
    try {
      for (const live of [false, true]) {
        if (this.cancelled) return;
        const file = await this.app.vault.create(
          `P5-${live ? 'live' : 'source'}-${Date.now()}.md`,
          'Synthetic fixture',
        );
        const leaf = this.app.workspace.getLeaf(false);
        await leaf.openFile(file, { state: { mode: 'source', source: !live } });
        if (!(leaf.view instanceof MarkdownView)) throw new Error('No MarkdownView');
        const markdown = leaf.view;
        const editor = markdown.editor;
        let view = [...this.views].find(
          (candidate) => candidate.state.field(editorInfoField, false)?.editor === editor,
        );
        for (let i = 0; !view && i < 20 && !this.cancelled; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          view = [...this.views].find(
            (candidate) => candidate.state.field(editorInfoField, false)?.editor === editor,
          );
        }
        if (!view || this.cancelled) throw new Error('Missing editor extension');
        const checks: Record<string, unknown> = {
          requestedLivePreview: live,
          actualLivePreview: view.state.field(editorLivePreviewField, false),
        };
        report[live ? 'live' : 'source'] = checks;
        const input =
          String.raw`\(a\) / \[b\]` +
          '\n\n`' +
          String.raw`\(code\)` +
          '`\n\n$' +
          String.raw`\(existing\)` +
          '$';
        editor.setValue(input);
        view.dispatch({ selection: { anchor: 0 } });
        editor.replaceRange('PRIOR ', { line: 0, ch: 0 }, undefined, '+input');
        const before = editor.getValue();
        const result = convertEditor(editor, view);
        const expected = 'PRIOR $a$ / $$b$$' + input.slice(input.indexOf('\n'));
        checks['manual'] = result.convertedCount === 2 && editor.getValue() === expected;
        editor.undo();
        checks['manualUndo'] = editor.getValue() === before;
        editor.redo();
        checks['manualRedo'] = editor.getValue() === expected;

        editor.setValue(String.raw`\(outside\) \(selected\)`);
        const old = editor.getValue();
        view.dispatch({ selection: { anchor: old.length, head: 12 } });
        convertEditor(editor, view);
        checks['selectedOnly'] = editor.getValue() === String.raw`\(outside\) $selected$`;
        editor.undo();
        checks['selectionUndo'] =
          editor.getValue() === old &&
          view.state.selection.main.anchor === old.length &&
          view.state.selection.main.head === 12;

        editor.setValue('no formula');
        const depth = undoDepth(view.state);
        convertEditor(editor, view);
        checks['noEmptyHistory'] = undoDepth(view.state) === depth;

        const fire = (payload: string, filePayload = false, alreadyHandled = false) => {
          const data = new DataTransfer();
          data.setData('text/plain', payload);
          data.setData('text/html', '<b>synthetic HTML</b>');
          if (filePayload)
            data.items.add(new File(['synthetic'], 'fixture.png', { type: 'image/png' }));
          const event = new ClipboardEvent('paste', { clipboardData: data, cancelable: true });
          if (alreadyHandled) event.preventDefault();
          this.app.workspace.trigger('editor-paste', event, editor, markdown);
          return event;
        };
        editor.setValue('PRIOR>');
        view.dispatch({ selection: { anchor: 6 } });
        const event = fire(String.raw`\(x\) / \[y\]`);
        checks['paste'] = enabled
          ? event.defaultPrevented && editor.getValue() === 'PRIOR>$x$ / $$y$$'
          : !event.defaultPrevented && editor.getValue() === 'PRIOR>';
        if (enabled) {
          editor.undo();
          checks['pasteUndo'] = editor.getValue() === 'PRIOR>';
          editor.redo();
          checks['pasteRedo'] = editor.getValue() === 'PRIOR>$x$ / $$y$$';
        }
        for (const [label, text, position] of [
          ['code', '`HERE`', 3],
          ['math', '$HERE$', 3],
          ['fence', '```\nHERE\n```', 6],
          ['yaml', '---\nx: HERE\n---', 8],
        ] as const) {
          editor.setValue(text);
          view.dispatch({ selection: { anchor: position } });
          const protectedBefore = editor.getValue();
          const actualSelection = {
            from: view.state.selection.main.from,
            to: view.state.selection.main.to,
          };
          const protectedEvent = fire(String.raw`\(x\)`);
          checks[`defaultIn${label}`] =
            !protectedEvent.defaultPrevented && editor.getValue() === protectedBefore;
          if (label === 'yaml' && actualSelection.from >= text.length) {
            checks['defaultInyaml'] = 'not-exercised-host-relocated-cursor';
            checks['yamlCursorRedirectHandled'] =
              editor.getValue().startsWith(protectedBefore) &&
              protectedEvent.defaultPrevented === enabled;
          }
          if (label === 'yaml')
            checks['yamlObservation'] = {
              requestedLength: text.length,
              beforeLength: protectedBefore.length,
              afterLength: editor.getValue().length,
              defaultPrevented: protectedEvent.defaultPrevented,
              actualSelection,
              addedTrailingNewline: protectedBefore === text + '\n',
              addedLeadingNewline: protectedBefore === '\n' + text,
            };
        }
        editor.setValue('plain');
        view.dispatch({ selection: { anchor: 5 } });
        checks['filesNotIntercepted'] =
          !fire(String.raw`\(x\)`, true).defaultPrevented && editor.getValue() === 'plain';
        fire(String.raw`\(x\)`, false, true);
        checks['alreadyHandledUnchanged'] = editor.getValue() === 'plain';
        checks['noMatchNotIntercepted'] =
          !fire('ordinary text').defaultPrevented && editor.getValue() === 'plain';
        view.dispatch({
          selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.cursor(3)]),
        });
        checks['multipleSelectionsNotIntercepted'] =
          !fire(String.raw`\(x\)`).defaultPrevented && editor.getValue() === 'plain';
        checks['manualMultipleSelections'] =
          convertEditor(editor, view).status === 'multiple-selections';
      }
    } catch (error) {
      report['error'] = String(error);
    }
    if (!this.cancelled)
      await this.app.vault.adapter.write(output, JSON.stringify(report, null, 2));
  }
}
