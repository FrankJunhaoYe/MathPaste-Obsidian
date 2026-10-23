# MathPaste 开发约定

## 项目与当前范围

- 仓库：`FrankJunhaoYe/MathPaste-Obsidian`；插件显示名：`MathPaste`；ID：`mathpaste`。
- 目标是 Windows Obsidian 内的公式定界符转换，MIT 协议，不需要账号、密钥或服务器。
- P1 接口验证见 `docs/p1-validation.md`，P2 转换核心及上限见 `docs/p2-rules.md`，已接入的命令、自动粘贴与设置见 `docs/host-validation.md`。P5 尚有待验证项；纯逻辑测试不等于宿主功能验收。
- 开始任务前读取用户当前指示、`docs/requirements.md`、`docs/development-plan.md` 和相关验收项。用户当轮范围优先。

## 改动流程

1. 先检查 `git status --short --branch` 和差异，保留用户及前序任务的未提交修改。
2. 功能开发使用 `feat/<topic>`，修复使用 `fix/<topic>`，工程和文档使用 `chore/<topic>` 或 `docs/<topic>`。发现已有工作分支时优先沿用。
3. 一次改动围绕一个目的，先确定输入、预期行为和验收编号，再实现最小改动。
4. 本地运行 `npm run check`，针对新行为补充有意义的测试；不要用占位断言伪装功能测试。
5. 用户已授权本项目在每次任务完成后自动提交、推送任务分支、创建 PR、审查改动并跟进 CI，无需逐次确认。
6. 审查差异、修复发现的问题，等待对应提交的所有 CI 检查通过；确认无未解决的阻断问题后合并到 `main`，同步本地并汇报 PR 链接与实际验证结果。
7. 如果 CI 失败、缺少权限或有不能确认的阻断问题，保留 PR 并说明原因，不跳过检查或强行合并。用户当轮要求只读、只计划或不上传时，以当轮限制为准。
8. 此授权覆盖任务范围内的 Git 协作，不包含正式版本发布、社区上架、操作日常笔记库或更改仓库权限与远程保护设置；这些步骤另按用户指示执行。

## 代码边界

- `src/main.ts` 负责宿主接入；后续转换核心与上下文识别分别放入 `src/converter.ts`、`src/context.ts`，设置放入 `src/settings.ts`，按实际需要创建。
- 转换逻辑与 Obsidian I/O 分离，纯逻辑返回最小修改集合，宿主统一应用编辑事务。
- 使用公开 Obsidian/CodeMirror API，不读取未公开内部属性。Obsidian、Electron、CodeMirror 和 Lezer 的宿主模块保持 external。
- 只修改成对公式的定界符，保留主体与无关内容；代码、已有数学区域、歧义输入和选区上下文必须纳入判断。
- 有效操作应可一次撤销；无变化时不写入。功能尚未实现时不得将这些目标标为已验证。
- 不上传笔记、记录剪贴板正文、加入遥测，或使用真实用户笔记作为公开测试样本。

## 环境与检查

- Node.js 版本以 `.node-version` 为准，npm 范围以 `package.json` 为准。优先 `npm ci`，依赖更新同时维护 `package-lock.json`。
- `npm run format` 负责格式整理；`npm run check` 包含格式、lint、类型、测试与构建。
- 初始化测试只验证插件元数据和打包契约，不代表公式转换、插件实际加载或宿主行为已验证。
- 功能测试覆盖正常输入、代码和已有公式保护、歧义输入、幂等性与选区边界；编辑器操作另做 Obsidian 测试库验收。
- `.github/workflows/ci.yml` 在 Windows 和 Linux 检查工程；Linux 通过不构成 Linux 插件支持承诺。

## 文件、版本与交付

- 源码、配置、测试和锁文件纳入 Git；`main.js`、依赖、测试库、笔记、日志和本地设置不入库。
- 保持 `package.json`、`manifest.json` 版本一致，`versions.json` 记录对应最低宿主版本。
- `minAppVersion` 当前为暂定 API 基线，未经实际宿主测试，不得声称覆盖所有更高版本。
- 只在专用测试库验证，不自动安装到日常库。不要将测试库放入公开仓库。
- 生成构建文件、发布 GitHub Release、申请社区上架是不同步骤。构建通过不等于插件功能通过。
- 新增依赖前确认必要性、维护状态、许可证、工具兼容范围和锁文件差异。CI action 固定到可核查的 commit。

更完整的协作说明见 `CONTRIBUTING.md`。
