import { Notice, PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';

export interface MathPasteSettings {
  readonly autoConvertPaste: boolean;
}

export function parseSettings(data: unknown): MathPasteSettings {
  if (
    typeof data === 'object' &&
    data !== null &&
    'autoConvertPaste' in data &&
    typeof data.autoConvertPaste === 'boolean'
  ) {
    return { autoConvertPaste: data.autoConvertPaste };
  }
  return { autoConvertPaste: true };
}

export class MathPasteSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    plugin: Plugin,
    private readonly current: () => MathPasteSettings,
    private readonly persistPreference: (enabled: boolean) => Promise<void>,
  ) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName('自动转换粘贴内容')
      .setDesc(
        '命中安全公式时按纯文本插入，HTML 独有的富文本格式会丢失。关闭后仍可使用手动命令；代码、图片/附件和超限文本保留默认粘贴。',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.current().autoConvertPaste).onChange(async (enabled) => {
          const previous = this.current().autoConvertPaste;
          toggle.setDisabled(true);
          try {
            await this.persistPreference(enabled);
          } catch {
            toggle.setValue(previous);
            new Notice('MathPaste 设置保存失败，请重试');
          } finally {
            toggle.setDisabled(false);
          }
        }),
      );
  }
}
