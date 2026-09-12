---
locale: "zh-CN"
translationKey: "kane-skills"
slug: "kane-skills"
translationStatus: "source"
categoryId: "project"
tagIds: ["agent-skills", "typescript", "ai-workflow", "developer-tools"]

title: "Kane Skills"
description: "一个公开、自包含的 Agent Skills 库，将内容生产、工程治理、技能演进、视觉创作与发布流程封装为 28 个可复用技能。"
cardDescription: "把反复出现的 Agent 工作流封装成 28 个独立技能，覆盖分析写作、技术核验、工程治理、视觉创作与发布交付。"
year: 2026
role: "技能设计、工作流抽象、仓库架构、文档与公开校验"
tags: ["Agent Skills", "TypeScript", "AI Workflow", "Developer Tools"]
cover: "/assets/projects/kane-skills/cover.webp"
featured: true
order: 3
github: "https://github.com/kanelogger/kane-skills"
designDoc: "https://github.com/kanelogger/kane-skills/blob/main/README-CN.md"
---

## 项目概览

- 问题：高频 Agent 工作流如果只留在对话、零散 Prompt 或私有项目配置里，就难以发现、复用、审阅和维护。
- 做法：每个技能以独立、自包含单元发布，必须包含 `SKILL.md`；按需附带 `scripts/`、`assets/`、`evals/`、`references/` 与 `agents/`，并保持技能目录路径稳定。
- 结果：当前公开 28 个技能，分为内容分析与写作、政策与技术核验、提示词与会话知识、产品与工程工作流、技能开发与演进、视觉创作、发布与交付保障七组。
- 代表能力：`article-analyzer`、`blog-checker`、`tech-claim-auditor`、`prompt-optimizer`、`requirement-explorer`、`skill-optimizer`、`kane-q-article-illustrator`、`verify-before-delivery`。
- 公开边界：仓库声明每个技能可独立检视、复制和适配，不依赖私有项目配置。
- 校验状态：2026-09-11 的 README 徽章明确显示 `Validation: failing`；网站可以描述技能数量和结构，不得宣称 28 个技能已全部通过公开校验。
- 发布状态：仓库没有 GitHub Release；入口使用 README 和技能目录，不渲染下载版本按钮。

## 本仓库是什么

- 一组以独立、自包含单元形式封装的**智能体技能（Agent Skills）**。
- 每个技能都包含 `SKILL.md`；大多数技能另附 `README.md` 公开速查。
- 根据需要可附带 `scripts/`、`assets/`、`evals/`、`references/`、`agents/` 等目录。


## 技能列表

28 个技能按主要使用目的分组。分类仅用于文档导航；技能目录仍保持在 `skills/` 的直接子目录中，避免改变现有路径和加载约定。

### 内容分析与写作（6）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`article-analyzer`](https://github.com/kanelogger/kane-skills/tree/main/skills/article-analyzer/) | 分析文章、论文、报告或长篇论述。 | 一组 Markdown 分析文件及 `99-summary.md`。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/article-analyzer/SKILL.md) |
| [`blog-checker`](https://github.com/kanelogger/kane-skills/tree/main/skills/blog-checker/) | 审阅中文技术博客文章。 | 结构化诊断审阅。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/blog-checker/SKILL.md) |
| [`concept-fable`](https://github.com/kanelogger/kane-skills/tree/main/skills/concept-fable/) | 通过三段式中文寓言解释高阶概念。 | 故事、概念揭示、理论映射、边界与阅读方向。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/concept-fable/SKILL.md) |
| [`douban-dice-review`](https://github.com/kanelogger/kane-skills/tree/main/skills/douban-dice-review/) | 用六枚理论骰子撰写简洁的豆瓣式影评。 | 骰子总结与六句影评。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/douban-dice-review/SKILL.md) |
| [`merge-drafts`](https://github.com/kanelogger/kane-skills/tree/main/skills/merge-drafts/) | 将多份草稿合并为一篇润色后的文章。 | 最终合并文章及合并报告。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/merge-drafts/SKILL.md) |
| [`subtext-article`](https://github.com/kanelogger/kane-skills/tree/main/skills/subtext-article/) | 将字幕、自动语音识别输出或转录文本转换为忠实的中文文章。 | 包含规范化转录、草稿、自检与终稿的完整文件夹。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/subtext-article/SKILL.md) |

### 政策与技术核验（2）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`analyze-china-policy`](https://github.com/kanelogger/kane-skills/tree/main/skills/analyze-china-policy/) | 核验并解释中国政策文件，比较措辞变化，判断执行强度和影响期限。 | 有证据的文件身份卡、三轴判断、影响地图与观察点。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/analyze-china-policy/SKILL.md) |
| [`tech-claim-auditor`](https://github.com/kanelogger/kane-skills/tree/main/skills/tech-claim-auditor/) | 核验 IT 技术文章中的事实、命令、配置、版本、性能数据与最佳实践。 | 可追溯的核验报告与最小修复稿。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/tech-claim-auditor/SKILL.md) |

### 提示词与会话知识（3）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`kane-prompts`](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-prompts/) | 从 `prompts/` 中查找、调用、轻量改写或组合常用提示词。 | 基于所选 Markdown 原文的可复制提示词，或按明确要求执行后的产物。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-prompts/SKILL.md) |
| [`prompt-optimizer`](https://github.com/kanelogger/kane-skills/tree/main/skills/prompt-optimizer/) | 将模糊需求转化为可直接复制使用的提示词。 | 一个 `.md` 或 `.xml` 提示词文件。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/prompt-optimizer/SKILL.md) |
| [`session-achieve`](https://github.com/kanelogger/kane-skills/tree/main/skills/session-achieve/) | 复盘多轮对话并提取可复用的提示词。 | 会话复盘与提示词经验。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/session-achieve/SKILL.md) |

### 产品与工程工作流（6）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`github-reuse-scout`](https://github.com/kanelogger/kane-skills/tree/main/skills/github-reuse-scout/) | 开发前搜索可复用的开源项目，并基于证据判断复用、参考或放弃复用。 | `.reuse/reuse-plan.md` 复用决策与迁移台账。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/github-reuse-scout/SKILL.md) |
| [`it-system-skill-distiller`](https://github.com/kanelogger/kane-skills/tree/main/skills/it-system-skill-distiller/) | 将 IT 业务系统提炼为智能体可读的能力包。 | 经过校验的 `distilled/` 包结构。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/it-system-skill-distiller/SKILL.md) |
| [`kane-explainer`](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-explainer/) | 用通俗语言解释技术规格、RFC、设计提案或工作区变更。 | 独立可读、包含行为和 schema 变化的中文技术说明。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-explainer/SKILL.md) |
| [`requirement-explorer`](https://github.com/kanelogger/kane-skills/tree/main/skills/requirement-explorer/) | 将原始业务需求推进成标准软件需求文档。 | 含 Mermaid 流程图和完整性自检的 Markdown 需求文档。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/requirement-explorer/SKILL.md) |
| [`request-refactor-plan`](https://github.com/kanelogger/kane-skills/tree/main/skills/request-refactor-plan/) | 将重构想法转化为小步提交的实施计划。 | 重构 RFC / GitHub issue 正文。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/request-refactor-plan/SKILL.md) |
| [`simplify-codebase`](https://github.com/kanelogger/kane-skills/tree/main/skills/simplify-codebase/) | 以可达性、契约和验证证据审计或简化代码库，移除意外复杂度。 | 排序后的证明记录，或带操作回执的已验证简化结果。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/simplify-codebase/SKILL.md) |

### 技能开发与演进（3）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`project-skill-evolver`](https://github.com/kanelogger/kane-skills/tree/main/skills/project-skill-evolver/) | 将多次会话纠偏沉淀为可追溯、受门禁保护且可回滚的技能改进。 | 项目 Wiki、回归评测、进化周期状态与回滚记录。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/project-skill-evolver/SKILL.md) |
| [`skill-evaluator`](https://github.com/kanelogger/kane-skills/tree/main/skills/skill-evaluator/) | 为智能体技能构建可复用的评估方案。 | 评估计划、评分模板与报告结构。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/skill-evaluator/SKILL.md) |
| [`skill-optimizer`](https://github.com/kanelogger/kane-skills/tree/main/skills/skill-optimizer/) | 审计并改进智能体技能。 | 审计报告、评估计划、改进提案与验收标准。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/skill-optimizer/SKILL.md) |

### 视觉创作（5）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`kane-avatar`](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-avatar/) | 根据图片或文字生成头像、超现实纸艺肖像、宠物肖像和纪念卡。 | 可复用的图片提示词，以及可用时生成的头像素材。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-avatar/SKILL.md) |
| [`kane-cover`](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-cover/) | 为文章、笔记和社交内容生成封面图及可复用提示词。 | 适配平台的封面提示词，以及可用时生成的封面素材。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-cover/SKILL.md) |
| [`kane-q-article-illustrator`](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-q-article-illustrator/) | 以 Kane Q IP 为固定叙述者与视觉锚点为文章配图。 | 保持 Kane Q 角色一致性的插图文章。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-q-article-illustrator/SKILL.md) |
| [`kane-q-cover-image`](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-q-cover-image/) | 以 Kane Q IP 生成文章封面图、社交封面与缩略图。 | 具有 Kane Q 品牌标识的封面图。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-q-cover-image/SKILL.md) |
| [`kane-q-infographic`](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-q-infographic/) | 以 Kane Q 为叙述者创建漫画风格信息图。 | Kane Q 视觉一致的信息图。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-q-infographic/SKILL.md) |

### 发布与交付保障（3）

| 技能 | 使用场景 | 输出 | 文档 |
| ---- | -------- | ---- | ---- |
| [`git-commit-push`](https://github.com/kanelogger/kane-skills/tree/main/skills/git-commit-push/) | 只暂存当前任务改动，依据暂存区 diff 生成 Conventional Commit，并安全推送。 | 已验证的提交与推送结果，同时保留无关改动。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/git-commit-push/SKILL.md) |
| [`kane-post-to-wx`](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-post-to-wx/) | 向微信公众号发布文章或贴图/图文内容。 | 微信预览或已提交的草稿，包含元数据和图片。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/kane-post-to-wx/SKILL.md) |
| [`verify-before-delivery`](https://github.com/kanelogger/kane-skills/tree/main/skills/verify-before-delivery/) | 为重要任务配置分级验证、证据闭环与独立复核。 | 交付物、逐项验证证据、未验证项与复核结论。 | [SKILL](https://github.com/kanelogger/kane-skills/tree/main/skills/verify-before-delivery/SKILL.md) |

## 许可

MIT。详见 [LICENSE](https://github.com/kanelogger/kane-skills/tree/main/LICENSE)。

![Kane Q 三视图](/assets/projects/kane-skills/01-kane-q-three-view.webp)

内容依据：[中文 README](https://github.com/kanelogger/kane-skills/blob/main/README-CN.md)，内容与校验状态截至 2026-09-11。
