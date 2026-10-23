import type { App, Plugin } from 'obsidian';
import { beforeEach, expect, it, vi } from 'vitest';

const ui = vi.hoisted(() => ({
  value: true,
  disabled: false,
  change: undefined as undefined | ((enabled: boolean) => Promise<void>),
  notice: vi.fn(),
}));
vi.mock('obsidian', () => ({
  PluginSettingTab: class {
    containerEl = { empty: vi.fn() };
  },
  Notice: class {
    constructor(message: string) {
      ui.notice(message);
    }
  },
  Setting: class {
    setName() {
      return this;
    }
    setDesc() {
      return this;
    }
    addToggle(callback: (toggle: unknown) => void) {
      const toggle = {
        setValue(value: boolean) {
          ui.value = value;
          return toggle;
        },
        setDisabled(value: boolean) {
          ui.disabled = value;
          return toggle;
        },
        onChange(change: typeof ui.change) {
          ui.change = change;
          return toggle;
        },
      };
      callback(toggle);
      return this;
    }
  },
}));
import { MathPasteSettingTab, parseSettings } from '../src/settings';

beforeEach(() => {
  ui.change = undefined;
  ui.disabled = false;
});

it('defaults to enabled and accepts only a stored boolean without importing unrelated fields', () => {
  for (const data of [null, undefined, false, [], {}, { autoConvertPaste: 'false' }]) {
    expect(parseSettings(data)).toEqual({ autoConvertPaste: true });
  }
  expect(parseSettings({ autoConvertPaste: false, unrelated: 'ignored' })).toEqual({
    autoConvertPaste: false,
  });
  expect(parseSettings({ autoConvertPaste: true })).toEqual({ autoConvertPaste: true });
});

it('shows the saved preference and disables the toggle until saving finishes', async () => {
  let finish!: () => void;
  const save = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const tab = new MathPasteSettingTab(
    {} as App,
    {} as Plugin,
    () => ({ autoConvertPaste: false }),
    save,
  );
  tab.display();
  expect(ui.value).toBe(false);
  const saving = ui.change!(true);
  expect(save).toHaveBeenCalledWith(true);
  expect(ui.disabled).toBe(true);
  finish();
  await saving;
  expect(ui.disabled).toBe(false);
  expect(ui.notice).not.toHaveBeenCalled();
});

it('restores the saved value and reports a persistence failure', async () => {
  const tab = new MathPasteSettingTab(
    {} as App,
    {} as Plugin,
    () => ({ autoConvertPaste: true }),
    async () => {
      throw new Error('disk failure');
    },
  );
  tab.display();
  ui.value = false;
  await ui.change!(false);
  expect(ui.value).toBe(true);
  expect(ui.disabled).toBe(false);
  expect(ui.notice).toHaveBeenCalledWith('MathPaste 设置保存失败，请重试');
});
