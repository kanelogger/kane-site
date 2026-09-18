# 内容导入手册

适用于添加或迁移文章、作品及其本地图片。新 checkout 直接使用本手册；本地可选的 `kane-site-content-import` Skill 不能替代当前 [Schema](../src/content.config.ts)。不在此流程中擅自润色原文或修改业务逻辑。

1. 检查 Git 状态、原文及相邻资源，确认内容类型、来源日期与公开范围。来源权限不明或必要图片缺失时停止该项导入并报告，禁止编造内容、链接、日期或占位图片。
2. 中文文章放 `src/content/blog/zh-CN/<slug>.md`，英文文章放 `src/content/blog/en/<slug>.md`；作品对应 `src/content/projects/<locale>/<slug>.md`。保留稳定 slug，不因重导入改变已发布 URL。
3. 从 [文章模板](../templates/blog.md) 或 [作品模板](../templates/project.md) 起草，按 Schema 填写全部必需字段。`locale`、`slug`、`translationKey`、`translationStatus`、`categoryId`、`tagIds` 不能漏填；同一内容的语言版本共用 `translationKey`，分类和标签的稳定 ID 参考现有内容及 [语言工具](../src/lib/i18n.ts)。
4. 保留原始发表与更新日期。原文使用 `source`；机器翻译使用 `machine`，人工审阅通过才能用 `reviewed`。`summary` 仅兼容已有英文摘要，不用于新增机器翻译。不擅自设为精选；文章 `featured: true` 还需 `featuredOrder`。
5. 将图片复制到 `public/assets/blog/<slug>/` 或 `public/assets/projects/<slug>/`，正文使用 `/assets/...` 站内地址并提供实际 alt。字体与图片不能依赖外部目录或远程热链。作品封面必需；未公开或不存在的项目链接省略字段，不留空字符串。
6. 保留正文含义，只处理必要的重复一级标题、图片路径和导入格式问题。将 wiki 链接转换为真实存在的站内路由；不存在的目标保留可读文字。移除私有源路径、内部链接与私有元数据。
7. 运行 `pnpm verify`，再按 [验收清单](agent-environment/commands.md) 检查详情页、列表和 dashboard 的图片、搜索、目录、键盘与移动布局，确认禁用 JavaScript 正文仍完整。停止自己启动的预览服务。
8. 交付记录新增文件、资源、保留的来源日期、省略的私有链接、实际检查结果及未解决事项。不要把私有原始路径写进公开记录。

内容集合没有草稿状态，进入 `src/content` 就会生成公开页面。未定稿材料放在集合之外；模板不是可直接发布的文章，需要替换示例内容。
