# 开发准备与实施建议

当前阶段仅保存开发资料，以下步骤尚未执行。本仓库没有 `package.json`，目前不能执行 `npm install`、构建或安装插件。

## 开始前准备

1. 记录 Windows 与 Obsidian 版本，作为兼容性验收基线。
2. 创建专用空白测试库，并记录库路径。Obsidian 官方教程建议在独立库开发插件。
3. 开发时检查 Git、Node.js、npm 和编辑器的实际可用版本，再根据所选模板要求确定工具版本。
4. 收集实际复制文本，按验收清单补齐输入与预期输出。

当前仅确认了 Git 和 GitHub CLI 可用；尚未检查本机 Node.js、Obsidian 安装或测试库。

## 建议实施顺序

1. **建立工程**：参考官方插件模板准备 TypeScript 工程、构建脚本和插件清单；插件 ID 建议使用 `mathpaste`，最低 Obsidian 版本依据实际 API 与测试结果填写。
2. **实现纯文本转换器**：转换函数独立于 Obsidian，接收文本及必要上下文，返回修改范围；优先完成配对、代码保护和已有数学区域保护。
3. **编写有意义的测试**：用验收文档中的输入输出验证保留内容、局部选区、幂等性和保守跳过行为。
4. **接入手动命令**：通过编辑器 API 修改选区或当前文档，验证光标、其他文本与撤销行为。
5. **接入粘贴处理**：核实目标 Obsidian 版本支持的事件/API，并验证编辑器位置上下文、普通粘贴、纯文本粘贴及富文本剪贴板的实际结果。
6. **测试库验收**：在 Windows 的源码模式和实时预览模式执行人工验收；原生图片、附件和其他插件的粘贴行为应保持可用。
7. **准备安装包**：功能与人工验收通过后再生成安装文件、版本说明和使用说明；是否发布 Release 或公开仓库由用户决定。

不要仅凭两条全局正则替换宣称满足全部要求。代码围栏、已有数学区域、转义和选区上下文会影响转换边界。实现细节应在实际工程与 API 验证后确定。

## 完成标准

- 文本转换用例有明确结果，所有失败均被处理或记录。
- 在实际 Obsidian 测试库中完成粘贴、手动命令和撤销验证。
- 记录测试平台与版本，并明确尚未验证的兼容范围。
- README 中的功能和安装说明与实际交付一致。

## 官方参考资料

以下资料于 2026-10-19 查阅，开发时应再次检查对应版本的 API。

- [Obsidian：Build a plugin](https://docs.obsidian.md/Plugins/Getting%20started/Build%20a%20plugin)：环境准备、独立测试库与插件加载流程。
- [Obsidian：Editor](https://docs.obsidian.md/Plugins/Editor/Editor)：编辑器命令与选区操作接口。
- [Obsidian 官方插件模板](https://github.com/obsidianmd/obsidian-sample-plugin)：TypeScript 工程和构建配置参考。
- [Obsidian：Advanced formatting syntax](https://help.obsidian.md/advanced-syntax)：数学公式定界符的使用说明。

这些链接用于后续开发参考；本次没有复制模板源码或开始实现插件。
