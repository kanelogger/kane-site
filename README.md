# KANE

Kane 的个人网站：AI Coding Agent、Agent Harness、开发者工具、作品与工程实践。

使用 Astro 7 Content Collections、Tailwind CSS 4 Vite 插件、GSAP / ScrollTrigger 和 Astro ClientRouter。所有页面静态构建，正文无需 JavaScript 即可阅读；字体和图片由本站托管。

## 本地开发与验证

使用 Node.js 22.12+ 和 pnpm（项目固定为 12.3.4）。

```sh
pnpm install
pnpm dev
pnpm check
pnpm build
pnpm verify:build
pnpm preview
```

以终端实际返回的预览地址为准。当前 Astro CLI 会在后台运行 dev / preview；用 `pnpm astro dev stop` 或 `pnpm astro preview stop` 停止相应服务器。受限环境可在命令前加 `ASTRO_TELEMETRY_DISABLED=1`，避免写入用户级遥测配置。

`check` 检查类型；`verify:build` 检查构建产物的内部链接、目录锚点、图片、主标题以及每份 Markdown 的列表和详情路由。浏览器验收另见 [阶段 5–6 验收记录](docs/implementation-5-6.md)。

## 发布与订阅

生产分支为 `main`，推送后由 Vercel Git 集成构建。主域名 `https://kanelogger.com` 在 `astro.config.mjs` 的 `site` 中配置；canonical、RSS 与 sitemap 均使用该主域名，页面路径不带尾斜杠。

每页提供标题、描述、Open Graph 和 Twitter 分享元数据；统一分享图为 `/og.png`（1200 × 630），图标为 `/favicon.svg`。`/sitemap-index.xml` 指向实际 sitemap 文件；`/robots.txt` 允许抓取公开页面。自定义 404 返回首页且标记 `noindex`。

RSS 入口为 `/rss.xml`，页面 head 和页尾均提供订阅链接。RSS 自动读取文章集合，输出标题、摘要、原始发布日期、标签与正式链接，顺序与 Writing 列表一致。

发布前运行 `pnpm check`、`pnpm build`、`pnpm verify:build`；构建检查同时校验 canonical、sitemap、RSS、robots、分享图和 404。预览或部署后运行 `pnpm verify:deployment http://127.0.0.1:4323`（替换为实际预览地址）或 `pnpm verify:deployment https://kanelogger.com`，检查全部页面、引用的图片/脚本/样式与自定义 404；资源内容与本地构建逐字节比对。真实手机移动网络仍需人工实测。

## 页面与目录

| 路径 | 内容 |
| --- | --- |
| `/` | 个人定位、精选作品、精选文章、简介与联系方式 |
| `/work`、`/work/[slug]` | 作品列表与详情 |
| `/writing`、`/writing/[slug]` | 文章列表与全文 |
| `/about` | About 与 GitHub、X、Email |
| `src/content/blog/*.md` | 文章 |
| `src/content/projects/*.md` | 作品 |
| `src/content.config.ts` | 内容字段校验与 glob 读取 |
| `src/components/`、`src/layouts/` | 共用组件与布局 |
| `src/styles/global.css` | 设计变量、排版、响应式 |
| `src/scripts/motion.ts` | 动画初始化、媒体查询与清理 |
| `public/assets/blog/<slug>/` | 文章图片 |
| `public/assets/projects/<slug>/` | 作品图片 |
| `templates/` | 可复制的内容模板 |

## 新增文章

1. 复制 `templates/blog.md` 到 `src/content/blog/my-article.md`。英文文件名会生成 `/writing/my-article`，无需手动改路由。
2. 填写 `title`、`description`、`publishedAt`（`YYYY-MM-DD`）、`category`、`tags`、`author`。日期按 UTC 格式显示，避免本地时区改变文章日期。
3. 首页精选设置 `featured: true` 和正整数 `featuredOrder`；首页按此顺序取前 4 篇。列表按发布日期倒序，同日按 `order` 升序，最后按 slug 排序。首版同日顺序已按内容清单写入。
4. 正文从 `##` 开始，不重复页面的一级标题。支持代码围栏、目录、引用块和 Markdown 表格；阅读时长按中文约 350 字/分钟、英文约 220 词/分钟估算，不计代码围栏。
5. 可选 `updatedAt`、`cover`；没有封面时省略字段，列表使用统一的文字样式。

## 新增作品

复制 `templates/project.md` 到 `src/content/projects/my-project.md`，替换全部示例字段。必填标题、描述、年份、职责、标签、真实封面路径、排序和 GitHub 地址。`featured: true` 会加入首页；作品列表与首页都按 `order` 升序。

`cardDescription` 可独立控制卡片说明；`release`、`designDoc` 只在有真实地址时填写，没有时删除字段，不填空字符串。图片和正文必须描述真实能力与发布状态，不添加未经证实的指标。

## 图片与字体

图片先放到 `public/assets/`，再在 Markdown 中引用，例如：

```md
![架构总览](/assets/blog/my-article/01.webp)
```

网址中不带 `public`。正文图片构建时自动读取尺寸，缺文件会使构建失败；浏览器延迟加载图片并保留空间，避免长文目录跳转后位置漂移。代码块、表格是独立的键盘可聚焦滚动区域。PNG 图表可使用 `cwebp -lossless source.png -o target.webp` 转换，检查文字清晰度后再接入。

Manrope Variable 与 Noto Sans SC Variable 通过 Fontsource 随应用打包为本地 WOFF2，按 Unicode 范围加载；不请求 Google Fonts。OFL 许可证位于 `public/assets/fonts/`。