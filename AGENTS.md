# Kane Site

Kane 的中文个人站，展示 AI Coding Agent、Agent Harness、开发者工具、作品与工程实践。使用 Astro 静态构建，优先保证内容真实、长文阅读、响应式与无障碍体验。

## 工具与验证

- 修改前检查 `git status --short`，保护已有与并发改动；跨会话任务先从 [任务入口](tasks/README.md) 恢复，再用当前源码与检查复核旧记录。
- 新 checkout、工具受限或环境变化时读取 [环境索引](AI_ENVIRONMENT.md)。Node 版本以 [.node-version](.node-version) 为准，pnpm 版本遵循 [package.json](package.json) 的 `packageManager`。
- 安装：`pnpm install --frozen-lockfile`；自检：`pnpm agent:doctor`。未安装依赖或 pnpm 时可直接运行 `node scripts/agent-doctor.mjs` 获取诊断。
- 页面、内容、配置或构建脚本变更后运行统一验证，它按顺序执行内容规则、类型检查、构建、产物检查、场景预算和回归检查，失败即停止：

  ```sh
  pnpm verify
  ```

- `verify:content` 全库检查内容路径、slug、翻译关系、排序和本地图片；`verify:build` 检查本地 `dist/` 的路由、链接、锚点、图片及 SEO / RSS 产物，必须先构建当前源码。
- 预览或部署验收时运行 `pnpm verify:deployment URL`，将 `URL` 替换为实际地址。脚本会将页面与资源同本地 `dist/` 逐字节比对；本地构建应对应待验收版本。
- dev / preview 地址以终端输出为准；若启动了后台服务，用 `pnpm astro dev stop` 或 `pnpm astro preview stop` 停止自己启动的服务。
- UI 变更还需在浏览器检查受影响页面的桌面与移动布局、键盘操作、页面往返和目录跳转；动效变更需检查减少动态效果与禁用 JavaScript。构建通过不等于浏览器验收通过。
- 纯文档改动运行 `pnpm verify:agent` 并核对命令、链接与事实。具体范围见 [命令与验收](docs/agent-environment/commands.md)。
- 多步骤、跨会话任务使用 [交接模板](templates/task.md)，在中断、阻塞和交付前更新；简单一次性修改不必新建任务。服务启停与清理见 [服务](docs/agent-environment/services.md)。

## 仓库级约束

- `README.md` 只用于介绍项目和 Kane 本人，不写维护教程；操作流程写入环境文档，变更记录写入 `CHANGELOG.md`。
- 正文在禁用 JavaScript 时仍须完整可读。动效尊重 `prefers-reduced-motion`，沿用 Astro 页面切换前清理、切换后初始化的生命周期，避免重复监听器和 ScrollTrigger。
- 图片与字体由本站托管。导入外部资料时，将正文和资源复制入仓库；构建不得依赖 Kane Vault 等站外目录或本机绝对路径。
- 公开文案只使用已确认可公开的资料，遵守内容清单中的项目排除项；不编造个人信息、项目能力、发布状态、链接或量化指标。
- 保留 `.gitignore` 中的私有资料边界：`private-*.md`、`.agents/`、`DESIGN.md`、`.agent-local/` 不加入版本控制；不将其中的私有路径、未公开信息写入公开文件、任务摘要或页面。
- 推送 `main` 会触发 Vercel 生产部署，应按发布操作处理。

## 按需指南

| 任务 | 先读 |
| --- | --- |
| 本地开发、环境与权限 | [环境索引](AI_ENVIRONMENT.md) |
| 内容录入与资源路径 | [内容导入手册](docs/content-import.md) |
| CI 与发布差异 | [CI 与发布](docs/agent-environment/ci-parity.md) |
| 内容字段与正文格式 | [内容 Schema](src/content.config.ts)、[文章模板](templates/blog.md)、[作品模板](templates/project.md) |
| 站点文案、文章排序与日期 | [站点数据](src/data/site.ts)、[内容工具](src/lib/content.ts) |
| 共用布局、视觉与动效 | [基础布局](src/layouts/BaseLayout.astro)、[全局样式](src/styles/global.css)、[动效生命周期](src/scripts/motion.ts) |
| 主域名与构建配置 | [Astro 配置](astro.config.mjs) |
| 构建与部署验收的具体范围 | [构建验证](scripts/verify-build.mjs)、[部署验证](scripts/verify-deployment.mjs) |

本地若存在私有内容清单或产品需求，在处理相应来源与公开范围时按需读取。这些文件不随仓库分发；不得让安装、构建或验证依赖它们。来源的公开范围不明时先确认。当前实现与验证结果以代码、配置和实际执行为准。

## 项目专属 Skill

添加或迁移文章、作品及其本地图片时，以 [内容导入手册](docs/content-import.md)、当前 Schema 和 `pnpm verify:content` 为可移植事实源；本地有 `kane-site-content-import` Skill 时配合使用。新 checkout 不要求安装私有 Skill。

该 Skill 不负责普通文案润色或已有页面的业务逻辑修改。内容目录没有草稿状态；未定稿内容不要写入 `src/content`，否则会在构建时生成公开页面。
