# 命令与验收

从仓库根目录执行。Node 精确版本读取 `.node-version`，pnpm 读取 `package.json#packageManager`；用已有版本管理器安装匹配版本。不要在自检中静默更改全局工具。

## 新 checkout

1. 读取 `AGENTS.md`，执行 `git status --short`。
2. 用 `node --version`、`pnpm --version` 核对版本。pnpm 缺失时按 [官方安装文档](https://pnpm.io/installation) 安装 `packageManager` 指定版本。
3. 执行 `pnpm install --frozen-lockfile`。禁止为通过安装删掉 lockfile、绕过版本检查或关闭锁定；首次安装需要包仓库网络与包缓存写权限。
4. 执行 `pnpm agent:doctor`，处理必需项的失败。它不会替你安装依赖或申请权限。
5. 执行 `pnpm verify`。返回非零时从失败步骤修复，不能把后续未运行项标记通过。

依赖未安装时，`node scripts/agent-doctor.mjs` 仍可诊断。环境资料本身可用 `node scripts/verify-agent-environment.mjs` 检查，不依赖第三方包。

## 检查选择

| 改动或动作 | 验收 |
| --- | --- |
| 纯文档 | `pnpm verify:agent`，再核对文档命令、链接与事实 |
| 页面、内容、配置、脚本 | `pnpm verify` |
| UI 或交互 | 上述检查，加受影响页面的桌面/移动布局、键盘、页面往返、目录跳转；有搜索时验证搜索 |
| 动效 | 上述检查，加 `prefers-reduced-motion` 和禁用 JavaScript；确认正文仍可读 |
| 部署 | 对应源码的本地构建，加 `pnpm verify:deployment URL`；参见 [发布差异](ci-parity.md) |

`pnpm verify` 的顺序以 `package.json#scripts.verify` 为准：`check` → `build` → `verify:build` → `verify:scene` → `test:deployment` → `test:scene` → `test:build` → `test:agent` → `verify:agent`。每一步失败即停止。`verify:build` 和 `verify:scene` 读取本次构建的 `dist/`，不能直接用旧产物证明新源码。`test:build` 将当前构建复制到临时目录，注入断链与缺图，确认验证器会拒绝它们，不修改真实 `dist/`。

部署回归测试在系统临时目录创建 fixture、绑定 `127.0.0.1` 临时端口，并在 finally 中清理。端口受限属于执行环境阻塞，不能算测试通过。允许后在具备对应权限的环境重跑。

常规检查不访问线上站点，不修改生产状态。安装写入 `node_modules` 和包缓存；构建写入 `.astro`、`dist`。保留未提交的用户改动，检查后用 `git status --short` 确认改动范围。

## 证据

记录执行日期、Git 基线与未提交改动、命令、退出码和关键结果。原始日志放 `.agent-local/`，其中可能有本机路径，不提交。共享记录必须包含足够的脱敏结果和复现步骤，不能只链接到别人无法获得的本地日志。未执行、受限、失败分别记录。
