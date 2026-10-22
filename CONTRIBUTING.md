# 开发与协作流程

## 当前状态

项目已完成 P1 首轮接口验证与 P2 纯转换核心；手动命令、自动粘贴和设置仍待接入。见 [P1 记录](docs/p1-validation.md) 与 [P2 规则、处理上限和验证](docs/p2-rules.md)。

## 本地准备

使用 `.node-version` 指定的 Node.js 24.13.0 与 npm 11。Node.js 的安装位置不作要求；不要将可执行文件复制到仓库。

首次获取源码后安装锁定的依赖：

```powershell
npm ci
npm run check
```

工程目录保持独立。宿主测试另建空白测试库，只在测试库启用插件。`npm run p1:prepare -- <新测试库绝对路径>` 可准备独立 P1 探针和产品空入口；目标的父目录须已存在，已有目录会被拒绝。探针不进入产品构建，不提供通用转换功能。

`minAppVersion: 1.1.0` 仅为初始化阶段的暂定 API 基线，后续根据实际 API 与宿主测试调整，不代表已验证 Obsidian 1.1.0 的兼容性。

## 常用命令

| 命令                   | 用途                                                          |
| ---------------------- | ------------------------------------------------------------- |
| `npm run dev`          | 监听源码变化，生成带内联 source map 的 `main.js`；Ctrl+C 退出 |
| `npm run typecheck`    | 严格 TypeScript 检查                                          |
| `npm run lint`         | ESLint 检查，不允许警告                                       |
| `npm run format`       | 用 Prettier 整理格式，会改写文件                              |
| `npm run format:check` | 只检查格式                                                    |
| `npm test`             | 运行测试并退出，不允许无测试静默通过                          |
| `npm run test:watch`   | 交互式监听测试                                                |
| `npm run build`        | 检查类型并生成生产构建 `main.js`                              |
| `npm run check`        | 执行全部门禁，与 CI 使用同一入口                              |

当前测试包括 P2 转换规则、上下文保护、位置映射及纯粘贴规划。P1 宿主结果单独记录；P2 自动测试不能替代通用转换的宿主验收。`node scripts/p2-benchmark.mjs` 运行合成输入基准，不写入笔记。

## 每次改动

1. 查看工作区状态和已有差异，选择单一任务，保留其他未提交改动。
2. 新功能用 `feat/<topic>`，修复用 `fix/<topic>`，工程用 `chore/<topic>`，文档用 `docs/<topic>`。
3. 涉及转换行为时，先给出“输入 → 预期输出”和验收编号，再实现并增加回归用例。
4. 运行 `npm run check`。通过后，只有新增修改或未解决的问题才需要重复检查。
5. 编辑器行为另在 Windows Obsidian 的源码模式和实时预览模式验收，检查粘贴、光标、撤销和重做。
6. 本项目已获用户持续授权：任务完成后自动提交、推送开发分支、创建 PR、审查差异并跟进 CI；审查和对应提交的所有 CI 检查通过、无未解决阻断问题后合并到 `main`，再同步本地。

上述流程不需要逐次确认。若用户当轮明确要求只读、只计划或不上传，则遵守当轮范围；检查失败或权限不足时保留 PR 并说明阻断，不绕过门禁。正式发布、社区上架和操作日常笔记库不包含在该持续授权内。

提交标题推荐 `feat:`、`fix:`、`test:`、`docs:`、`chore:`；不引入本地 Git hooks 或强制修改个人 Git 配置。远程分支保护可后续配置，当前文档不代表已经启用。

PR 说明应写清最终行为、实际验证和未验证项，使用仓库模板。Windows CI 是主要工程检查，Linux CI 用于发现路径大小写、换行和构建可移植性问题，不扩展产品支持平台。

## 依赖与版本

- 使用 `npm ci` 复现；新增或更新依赖使用 `npm install --save-dev --save-exact <package>@<version>`，审查并提交锁文件。
- 保持工具间 peer dependency 兼容，不仅因为有新版本就升级。
- 版本变更同时维护 `package.json`、`manifest.json`、`versions.json` 和锁文件。`0.1.0` 当前只是开发版本号，没有发布。
- `private: true` 用于防止误发布到 npm，与 GitHub 仓库公开状态无关。

## 交付检查

- CI 与本地工程检查通过，功能用例和宿主验收单独记录。
- 安装文件、源码与版本一致，README 的能力描述与实现一致。
- `main.js` 为忽略的构建产物，不提交到源码分支；安装包或 Release 由明确的交付步骤生成。
- 不提交日常笔记、测试库、密钥、插件本地设置或日志。
- 当前 CI 仅检查，不上传安装包、不创建 Release、不发布到 npm 或社区插件市场。

## 参考

工程布局和 CommonJS/external 约定参考 [Obsidian 官方插件模板](https://github.com/obsidianmd/obsidian-sample-plugin)，具体实现与依赖版本以本仓库配置和锁文件为准。
