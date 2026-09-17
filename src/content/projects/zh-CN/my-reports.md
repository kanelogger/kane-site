---
locale: "zh-CN"
translationKey: "my-reports"
slug: "my-reports"
translationStatus: "source"
categoryId: "project"
tagIds: ["static-site", "github-pages", "nodejs", "research-archive"]

title: "报告馆"
description: "一个部署在 GitHub Pages 的个人研究归档，用 Node.js 自动汇总独立 HTML 报告和子站入口。"
cardDescription: "把分散的研究报告和互动网页收进一个按时间组织的公开索引，提交后由 GitHub Pages 自动部署。"
year: 2026
role: "项目设计与开发、内容整理"
tags: ["Static Site", "GitHub Pages", "Node.js", "Research Archive"]
cover: "/assets/projects/my-reports/cover.webp"
featured: false
order: 5
website: "https://kanelogger.github.io/my-reports/"
github: "https://github.com/kanelogger/my-reports"
---

## 项目概览

报告馆是一个个人研究归档站。它把单页 HTML 报告、互动课程和包含独立资源的子站收进同一个入口，让分散的交付物可以按时间浏览。

- 独立报告直接保存在 `reports/` 目录中。
- 复杂报告可以使用带 `index.html` 的子目录，并保留各自的样式与脚本。
- `generate-index.js` 扫描入口、读取标题和日期，生成按月分组的首页。
- 推送到主分支后，GitHub Actions 将整个静态站点部署到 GitHub Pages。

## 入口与边界

可以直接访问 [报告馆](https://kanelogger.github.io/my-reports/)，也可以在 [GitHub 仓库](https://github.com/kanelogger/my-reports) 查看索引生成脚本和公开报告。

当前站点是静态归档，各份报告的版式、脚本和移动端适配由对应 HTML 交付物自行负责。
