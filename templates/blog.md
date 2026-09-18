---
locale: "zh-CN"
translationKey: "my-article"
slug: "my-article"
translationStatus: "source"
categoryId: "ai-engineering"
tagIds: ["coding-agent"]
title: "文章标题"
description: "用一两句话说明文章解决的问题。"
publishedAt: 2026-09-11
category: "AI 编程"
tags: ["Coding Agent"]
featured: false
order: 0
author: "Kane"
# featured: true 时必须填写 featuredOrder；首页最多显示前 4 篇。
# featuredOrder: 5
# updatedAt: 2026-09-12
# cover: "/assets/blog/my-article/cover.webp"
---

在这里写导语。放入 `src/content/blog/zh-CN/my-article.md`，文件名与 slug 保持一致，对应 `/writing/my-article`。翻译版本使用相同 translationKey，并正确填写 locale 与 translationStatus。

## 要解决的问题

正文从二级标题开始，页面自动提供一级标题和目录。

## 方法与证据

```ts
const result = '用实际代码与结果说明方法';
```

> 这里可以保留引用与作者说明。

| 项目 | 说明 |
| --- | --- |
| 验证 | 写清实际观察到的结果 |

图片先放进 `public/assets/blog/my-article/`，再插入：

<!-- ![说明图片内容](/assets/blog/my-article/01.webp) -->

## 参考资料

补充实际使用的来源链接与适用日期。
