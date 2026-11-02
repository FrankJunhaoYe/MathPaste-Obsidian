<div align="center">

<h1>MathPaste</h1>

<p>粘贴公式，少改一遍定界符。</p>

<p>面向 Windows 版 Obsidian 的本地 LaTeX 公式定界符转换插件。</p>

<p>
  <a href="https://github.com/FrankJunhaoYe/MathPaste-Obsidian/actions/workflows/ci.yml"><img src="https://github.com/FrankJunhaoYe/MathPaste-Obsidian/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <img src="https://img.shields.io/badge/platform-Windows-0078D4" alt="平台：Windows">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="协议：MIT"></a>
</p>

<p>
  <a href="#转换效果">转换效果</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#使用方式">使用方式</a> ·
  <a href="#常见问题">常见问题</a> ·
  <a href="https://github.com/FrankJunhaoYe/MathPaste-Obsidian/issues">问题反馈</a>
</p>

</div>

复制来的文本中，公式常以 `\(...\)` 或 `\[...\]` 包裹。MathPaste 在粘贴时将它们转换为 Obsidian 使用的 `$...$` 和 `$$...$$`，保留公式内部的 LaTeX 内容；也可以通过命令处理已有笔记。

> **开发试用版 · 0.1.0**：目前通过源码构建并手动安装，尚未发布正式版本或上架社区插件。请先在独立测试库试用；完整宿主验收仍有待完成项，见[兼容性与验证](#兼容性与验证)。

## 转换效果

| 类型     | 转换前                          | 转换后                        |
| -------- | ------------------------------- | ----------------------------- |
| 行内公式 | `由 \(a^2 + b^2 = c^2\) 可知。` | `由 $a^2 + b^2 = c^2$ 可知。` |
| 独立公式 | `\[E = mc^2\]`                  | `$$E = mc^2$$`                |

多行公式保留原有排版与公式主体。

**转换前**

```latex
\[
\boxed{\bar X\approx N\left(\mu,\frac{\sigma^2}{n}\right)}
\]
```

**转换后**

```latex
$$
\boxed{\bar X\approx N\left(\mu,\frac{\sigma^2}{n}\right)}
$$
```

以上代码块仅展示输入输出。实际笔记中的代码区域会被跳过；同行的独立公式只替换定界符，不额外添加换行。

## 功能

- **粘贴即转换**：默认开启，仅处理本次插入文本中可安全配对的公式。
- **按需手动转换**：有选区时处理选区内的完整公式，无选区时处理当前笔记。
- **保护上下文**：跳过代码、已有美元公式、YAML、链接等受保护区域；歧义输入保守保留。
- **保留公式主体**：只替换外层定界符，保留命令、空格和原有换行结构。重复转换不会继续修改已转换的公式。
- **支持撤销与重做**：一次有效操作可一次撤销；无变化时不新增编辑记录。
- **本地处理**：无需账号、密钥或服务器，不上传笔记或剪贴板内容，不加入遥测。

## 快速开始

### 1. 从源码构建

需要 Git、Node.js **24.13.0**（见 [`.node-version`](.node-version)）和 **npm 11**。

```powershell
git clone https://github.com/FrankJunhaoYe/MathPaste-Obsidian.git
cd MathPaste-Obsidian
npm ci
npm run build
```

### 2. 安装到独立测试库

在测试库中创建 `.obsidian/plugins/mathpaste/`，将构建生成的 `main.js` 和仓库中的 `manifest.json` 复制到该目录：

```text
<测试库>/
└── .obsidian/
    └── plugins/
        └── mathpaste/
            ├── main.js
            └── manifest.json
```

当前无需 `styles.css`，也无需安装开发探针。重新加载 Obsidian，在 **设置 → 第三方插件** 中允许并启用 **MathPaste**。

### 3. 试一次转换

在 Markdown 笔记的源码模式或实时预览模式中，将下面这行复制并粘贴到普通正文位置，预期得到 `由 $x^2 + y^2 = z^2$ 可知。`：

```text
由 \(x^2 + y^2 = z^2\) 可知。
```

卸载时，先禁用插件，再删除测试库中的 `.obsidian/plugins/mathpaste/` 文件夹即可。

## 使用方式

### 自动转换

启用后默认生效。在 Markdown 编辑器中正常粘贴即可，无成功弹窗；没有安全匹配时沿用默认粘贴。

**命中公式时，插件按剪贴板的纯文本插入，HTML 独有的字体、表格等富文本格式会丢失。** 需要保留富文本时，可先在 **设置 → MathPaste → 自动转换粘贴内容** 关闭开关，再粘贴并按需运行手动命令。

### 手动转换

1. 选中要处理的文本；若要处理当前整篇笔记，则取消选区。
2. 按 `Ctrl+P` 打开命令面板。
3. 执行 **MathPaste：转换公式定界符（选区或当前笔记）**。

只有完整包含在选区内的公式才会转换。命令需要处于 Markdown 编辑视图；插件不预设快捷键，可在 Obsidian 的快捷键设置中自行绑定。

### 撤销与设置

使用 `Ctrl+Z` 撤销，`Ctrl+Shift+Z` 重做。关闭自动转换后，手动命令仍然可用；开关只在保存成功后生效，保存失败时会提示并恢复原值。

## 常见问题

### 为什么有些公式没有转换？

MathPaste 会结合完整笔记判断上下文。以下情况会保留原文或沿用默认粘贴：

- 公式位于代码、已有美元数学、YAML、Markdown 链接或图片、wiki 链接、注释等受保护区域，或所在文本块包含行内 HTML、不完整结构。
- 定界符未配对、嵌套、交叉、重复转义，行内公式跨行，或公式主体含未转义的美元符号。
- 相邻公式或紧邻美元符号的配对可能产生含糊的美元连续串。
- 选区只覆盖部分公式，或同时存在多个光标、多个选区。手动命令仅支持单选区。
- 粘贴含文件或图片载荷、已由其他插件处理，或超出处理上限。

精确规则与边界样例见 [P2 转换规则](docs/p2-rules.md)。

### 为什么只选了一小段，仍提示文本过大？

上下文保护需要检查完整笔记。当前同步处理上限为：全文 **32,768** 个 UTF-16 代码单元、单行 **8,192** 个、结构标记 **2,048** 个。UTF-16 代码单元并不总等于可见字符数。

任一超限时，手动命令提示并保持原文，自动转换交回默认粘贴。较小选区也不会绕过全文限制。

### 可以转换从 ChatGPT 或网页复制的公式吗？

转换依据是剪贴板中的纯文本；其中需要保留成对的 `\(...\)` 或 `\[...\]`。如果复制后只剩图片或渲染结果，插件无法还原 LaTeX。MathPaste 不提供 OCR、公式纠错或模型调用；实际 ChatGPT、浏览器外部富文本复制链路仍待完整验收。

## 兼容性与验证

当前支持范围为 **Windows 桌面版 Obsidian**，最低版本声明为 **1.14.4**。已有宿主记录覆盖 1.14.4 与 1.14.5 中的部分流程，其他版本尚未验证；不作移动端、macOS 或 Linux 的兼容性承诺。

| 验证范围           | 当前证据                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| 转换规则与编辑事务 | 自动测试覆盖配对、保护、选区、幂等性、输入上限及撤销/重做                                            |
| 命令与原生文本粘贴 | Windows Obsidian 1.14.4 已记录命令、实时预览文本粘贴及撤销/重做                                      |
| Windows CRLF 粘贴  | 1.14.5 中，源码与实时预览的合成 DOM 粘贴通过；源码模式另有原生复制/粘贴、撤销/重做和阅读模式渲染记录 |
| 完整宿主验收       | 尚未完成：真实图片/附件、外部富文本、设置保存后重载、禁用清理、实时预览属性面板等仍有待验证项        |

自动测试和合成事件不能代替所有原生操作验收。详细环境、输入与证据类型见[宿主验收记录](docs/host-validation.md)和[验收清单](docs/acceptance.md)。

## 开发与贡献

欢迎通过 [Issues](https://github.com/FrankJunhaoYe/MathPaste-Obsidian/issues) 反馈问题或提交 PR。报告问题时，请提供 Obsidian 版本、编辑模式、复现步骤及最小合成样例，避免附带私人笔记或剪贴板正文。

```powershell
npm ci
npm run check
```

`npm run check` 包含格式、lint、类型、测试与构建检查。`npm run dev` 监听构建，`npm run build` 生成 `main.js`。CI 在 Windows 与 Linux 上检查工程，Linux CI 通过不代表插件已支持 Linux。

转换核心、上下文识别与 Obsidian 接入分别维护。开发探针和测试库不进入产品包；完整流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 文档

| 文档                                    | 内容                             |
| --------------------------------------- | -------------------------------- |
| [需求说明](docs/requirements.md)        | 功能范围、转换目标与不包含的能力 |
| [开发计划](docs/development-plan.md)    | 阶段安排、技术方案与交付条件     |
| [P1 接口验证](docs/p1-validation.md)    | 宿主接口与前期验证               |
| [P2 转换规则](docs/p2-rules.md)         | 配对、保护、处理上限与核心验证   |
| [宿主验收记录](docs/host-validation.md) | 实际操作结果、回归修复与待验证项 |
| [验收清单](docs/acceptance.md)          | 自动用例与 Obsidian 人工验收状态 |
| [开发与协作流程](CONTRIBUTING.md)       | 环境、检查命令与 PR 流程         |

## 许可证

[MIT](LICENSE)
