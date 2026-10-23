import type { App, Command, Editor, MarkdownView, PluginManifest } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { beforeEach, expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({
  load: vi.fn<() => Promise<unknown>>(),
  save: vi.fn<(data: unknown) => Promise<void>>(),
  editor: {} as Editor,
  command: undefined as Command | undefined,
  extension: undefined as undefined | (new (view: EditorView) => { destroy(): void }),
  paste: undefined as
    undefined | ((event: ClipboardEvent, editor: Editor, context: MarkdownView) => void),
  persist: undefined as undefined | ((enabled: boolean) => Promise<void>),
  current: undefined as undefined | (() => { autoConvertPaste: boolean }),
  registerEvent: vi.fn(),
  convertEditor: vi.fn(() => ({ status: 'unchanged', convertedCount: 0 })),
  convertPaste: vi.fn(),
}));
vi.mock('@codemirror/view', () => ({
  ViewPlugin: { fromClass: (extension: typeof host.extension) => extension },
}));
vi.mock('obsidian', () => ({
  Plugin: class {
    app = {
      workspace: {
        on: (_name: string, callback: typeof host.paste) => {
          host.paste = callback;
          return 'event-ref';
        },
      },
    };
    loadData = host.load;
    saveData = host.save;
    registerEditorExtension(extension: typeof host.extension) {
      host.extension = extension;
    }
    addCommand(command: Command) {
      host.command = command;
    }
    registerEvent = host.registerEvent;
    addSettingTab() {}
  },
  MarkdownView: class {
    getMode() {
      return 'source';
    }
  },
  Notice: class {},
  editorInfoField: {},
}));
vi.mock('../src/settings', () => ({
  parseSettings: (data: { autoConvertPaste?: boolean } | undefined) => ({
    autoConvertPaste: data?.autoConvertPaste ?? true,
  }),
  MathPasteSettingTab: class {
    constructor(
      _app: unknown,
      _plugin: unknown,
      current: typeof host.current,
      persist: typeof host.persist,
    ) {
      host.current = current;
      host.persist = persist;
    }
  },
}));
vi.mock('../src/editor', () => ({
  convertEditor: host.convertEditor,
  convertPaste: host.convertPaste,
  resultMessage: () => 'result',
}));
import { MarkdownView as MarkdownViewClass } from 'obsidian';
import MathPastePlugin from '../src/main';

beforeEach(() => {
  host.load.mockResolvedValue(undefined);
  host.save.mockResolvedValue();
  host.extension = undefined;
  host.command = undefined;
  host.paste = undefined;
});

async function load() {
  const plugin = new MathPastePlugin({} as App, {} as PluginManifest);
  await plugin.onload();
  const view = { state: { field: () => ({ editor: host.editor }) } } as unknown as EditorView;
  const extension = new host.extension!(view);
  const context = new MarkdownViewClass({} as ConstructorParameters<typeof MarkdownViewClass>[0]);
  return { plugin, view, extension, context };
}

it('registers the paste event for cleanup and routes only available editing views', async () => {
  const f = await load();
  expect(host.registerEvent).toHaveBeenCalledWith('event-ref');
  const command = host.command!.editorCheckCallback!;
  expect(command(true, host.editor, f.context)).toBe(true);
  expect(host.convertEditor).not.toHaveBeenCalled();
  command(false, host.editor, f.context);
  expect(host.convertEditor).toHaveBeenCalledWith(host.editor, f.view);
  vi.spyOn(f.context, 'getMode').mockReturnValue('preview');
  expect(command(true, host.editor, f.context)).toBe(false);
  host.paste!({} as ClipboardEvent, host.editor, f.context);
  expect(host.convertPaste).not.toHaveBeenCalled();
  vi.spyOn(f.context, 'getMode').mockReturnValue('source');
  f.extension.destroy();
  expect(command(true, host.editor, f.context)).toBe(false);
});

it('loads a disabled preference, preserves manual conversion and updates only after a successful save', async () => {
  host.load.mockResolvedValue({ autoConvertPaste: false });
  const f = await load();
  const event = {} as ClipboardEvent;
  host.paste!(event, host.editor, f.context);
  expect(host.convertPaste).toHaveBeenLastCalledWith(event, host.editor, f.view, false);
  expect(host.command!.editorCheckCallback!(true, host.editor, f.context)).toBe(true);
  host.save.mockRejectedValueOnce(new Error('disk failure'));
  await expect(host.persist!(true)).rejects.toThrow('disk failure');
  expect(host.current!().autoConvertPaste).toBe(false);
  await host.persist!(true);
  expect(host.save).toHaveBeenLastCalledWith({ autoConvertPaste: true });
  host.paste!(event, host.editor, f.context);
  expect(host.convertPaste).toHaveBeenLastCalledWith(event, host.editor, f.view, true);
  f.plugin.onunload();
  host.convertPaste.mockClear();
  host.convertEditor.mockClear();
  host.paste!(event, host.editor, f.context);
  expect(host.command!.editorCheckCallback!(false, host.editor, f.context)).toBe(false);
  expect(host.convertPaste).not.toHaveBeenCalled();
  expect(host.convertEditor).not.toHaveBeenCalled();
});

it('does not register callbacks if unloading while preferences are still loading', async () => {
  let finish!: (data: unknown) => void;
  host.load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const plugin = new MathPastePlugin({} as App, {} as PluginManifest);
  const loading = plugin.onload();
  plugin.onunload();
  finish({ autoConvertPaste: true });
  await loading;
  expect(host.command).toBeUndefined();
  expect(host.paste).toBeUndefined();
  expect(host.extension).toBeUndefined();
});
