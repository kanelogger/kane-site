# 内容导入手册

适用于添加或迁移文章、作品及其本地图片。新 checkout 直接使用本手册；本地可选的 `kane-site-content-import` Skill 只作辅助，当前 [Schema](../src/content.config.ts) 和本手册是公开事实源。不在此流程中擅自润色原文或修改业务逻辑。

## 1. 同步并确认基线

1. 执行 `git fetch origin --prune`，再检查 `git status --short --branch`、当前分支、上游分支和 `git rev-list --left-right --count HEAD...@{upstream}`。用 `git diff --name-only --diff-filter=U` 确认没有未合并冲突。
2. 确认正在编辑本次任务预期的分支。分支落后且工作区干净时只使用 `git pull --ff-only`；存在本地改动时停止并报告，不自动 stash、覆盖、丢弃或改写历史。
3. 检查原文及相邻资源，确认内容类型、来源日期与公开范围。来源权限不明或必要图片缺失时停止该项导入，禁止编造内容、链接、日期或占位图片。

## 2. 导入正文与资源

1. 从 [文章模板](../templates/blog.md) 或 [作品模板](../templates/project.md) 复制新文件。中文文章放 `src/content/blog/zh-CN/<slug>.md`，英文文章放 `src/content/blog/en/<slug>.md`；作品放 `src/content/projects/<locale>/<slug>.md`。
2. 文件名与 `slug` 保持一致，使用新的英文 kebab-case 短名。同一内容的语言版本共用 `translationKey` 和 slug；已发布 slug 不因重导入改变。
3. 按 Schema 填写全部必需字段。`locale`、`slug`、`translationKey`、`translationStatus`、`categoryId`、`tagIds` 不能漏填；分类和标签的稳定 ID 参考现有内容及 [语言工具](../src/lib/i18n.ts)。
4. 保留原始发表与更新日期。原文使用 `source`；机器翻译使用 `machine`，人工审阅通过才能用 `reviewed`。`summary` 仅兼容已有英文摘要，不用于新增机器翻译。不擅自设为精选；文章 `featured: true` 还需唯一的 `featuredOrder`，作品 `order` 在同一 locale 内必须唯一。
5. 图片复制到 `public/assets/blog/<slug>/` 或 `public/assets/projects/<slug>/`，封面和正文图片均使用对应 slug 下的 `/assets/...` 站内地址；正文图片提供实际 alt。字体与图片不能依赖外部目录或远程热链。作品封面必需；未公开或不存在的项目链接省略字段，不留空字符串。
6. 保留正文含义，只处理必要的重复一级标题、图片路径和导入格式问题。将 wiki 链接转换为真实存在的站内路由；不存在的目标保留可读文字。移除私有源路径、内部链接与私有元数据。

内容集合没有草稿状态，进入 `src/content` 就会生成公开页面。未定稿材料放在集合之外；模板不是可直接发布的文章，需要替换示例内容。

## 3. 本地验证

1. 运行 `pnpm verify`。它先执行全库内容规则校验，再执行类型检查、构建、产物检查和回归测试；任一步失败都先修复再继续。
2. 按 [验收清单](agent-environment/commands.md) 检查受影响详情页、列表和 dashboard 的图片、搜索、目录、键盘操作、页面往返与桌面/移动布局，确认禁用 JavaScript 时正文仍完整。
3. 停止本任务启动的 preview 服务。交付记录新增文件、资源、保留的来源日期、省略的私有链接、实际检查结果及未解决事项，不把私有原始路径写进公开记录。

## 4. 提交与发布

1. 用明确文件路径暂存本次文章、作品和相关资源，不使用会混入无关改动的宽泛暂存命令。执行 `git diff --cached --name-status` 和 `git diff --cached --check`，确认暂存区只包含本次内容且没有空白错误。
2. 提交和推送属于外部写入，必须得到用户明确授权。不得自动 push、force push、amend 或改写历史。项目约定推送 `main` 会触发 Vercel 生产部署，但 CI 与 Vercel 的实际状态仍需在发布时确认。

## 5. 生产验收

1. 对应提交部署完成后，使用该提交生成并已通过本地验证的 `dist/` 运行 `pnpm verify:deployment https://kanelogger.com`，确认正式页面、资源、RSS、sitemap 和 404 与本地构建一致。
2. 在浏览器打开新增正式页面复核正文、图片和移动布局。文章新增或更新时同时打开 `https://kanelogger.com/rss.xml`，确认标题、链接和发布日期正确。
3. 部署或浏览器验收不可用时如实记录为未验证，不能用本地构建通过替代生产验收。
