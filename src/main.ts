import { ViewPlugin, type EditorView } from '@codemirror/view';
import { Plugin, MarkdownView, Notice, editorInfoField, type Editor } from 'obsidian';
import { convertEditor, convertPaste, resultMessage } from './editor';
import { MathPasteSettingTab, parseSettings } from './settings';

export default class MathPastePlugin extends Plugin {
  private readonly views = new Set<EditorView>();
  private preferences = parseSettings(undefined);
  private disposed = false;

  async onload(): Promise<void> {
    this.preferences = parseSettings(await this.loadData());
    if (this.disposed) return;
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
    this.addCommand({
      id: 'convert-math-delimiters',
      name: '转换公式定界符（选区或当前笔记）',
      editorCheckCallback: (checking, editor, context) => {
        const view = this.findView(editor);
        if (
          this.disposed ||
          !(context instanceof MarkdownView) ||
          context.getMode() !== 'source' ||
          !view
        )
          return false;
        if (!checking) new Notice(resultMessage(convertEditor(editor, view)));
        return true;
      },
    });
    this.registerEvent(
      this.app.workspace.on('editor-paste', (event, editor, context) => {
        if (this.disposed || !(context instanceof MarkdownView) || context.getMode() !== 'source')
          return;
        const view = this.findView(editor);
        if (view) convertPaste(event, editor, view, this.preferences.autoConvertPaste);
      }),
    );
    this.addSettingTab(
      new MathPasteSettingTab(
        this.app,
        this,
        () => this.preferences,
        async (enabled) => {
          const next = { autoConvertPaste: enabled };
          await this.saveData(next);
          this.preferences = next;
        },
      ),
    );
  }

  onunload(): void {
    this.disposed = true;
    this.views.clear();
  }

  private findView(editor: Editor): EditorView | undefined {
    return [...this.views].find(
      (view) => view.state.field(editorInfoField, false)?.editor === editor,
    );
  }
}
