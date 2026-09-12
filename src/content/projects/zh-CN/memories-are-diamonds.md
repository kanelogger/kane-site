---
locale: "zh-CN"
translationKey: "memories-are-diamonds"
slug: "memories-are-diamonds"
translationStatus: "source"
categoryId: "project"
tagIds: ["agent", "journal", "typescript", "markdown"]

title: "回忆是钻石"
description: "一个日记型 Agent：用 Markdown 与 TypeScript CLI 保存真实生活，让 AI 辅助整理、追问和复盘，由人保留最终判断。"
cardDescription: "人记录真实体验，AI 帮助找回遗漏的细节。用日记、周期复盘和成长目标，把经历积累成回忆。"
year: 2026
role: "产品设计、TypeScript CLI 开发"
tags: ["Agent", "日记", "TypeScript", "Markdown"]
cover: "/assets/projects/memories-are-diamonds/cover.webp"
featured: false
order: 4
---

## 项目初衷

项目的初衷其实一句话就能概括：一天怎么过，决定它是失去的一天，还是被积累下来的一天。

刚开始也是一个很直接的想法：人生是不断收集回忆的过程。到最后，真正能够长期陪伴我们的，往往也只有回忆。所以我就想通过写日记的方式保存回忆。

毕竟很多事情过了一个年纪，体验上就完全不一样了。20 岁的时候爬山，可能是一种浪漫；到了 40 岁再去找同样的浪漫，身体、心境、处境都已经变了，甚至可能先感受到的是腰酸。

生活的每一个好的坏的都不会停下来等人。它们发生过，但如果不被记录，很快就会被新的事情覆盖，最后变成一片模糊。

我想保存的正是这些东西：当天的真实感受、具体场景、小成果、低落、消耗、念头、关系、地点和身体状态。它们不一定宏大，却共同构成了一个人真正走过的日子。通过日记的方式记录不让生活轻易消失在过去。

那以前为什么不写日记呢？

嫌麻烦。生活是连续的，回忆却是碎片，拼凑起来费时费力，为了解决这个问题，就让AI来减轻点负担。通过几件标志性的事件和时间点大致描绘出一天的轮廓。

## 这个项目做什么

首先要守住人的原始体验。最原始的材料一定要是来自真实生活。

所以我没把项目设计成知识库，整体结构是松散的，只有生成各种报告的时候才会被整理。

也没把他设计成任务管理器和每日打卡的工具，就是纯粹的日记。但是也给打卡功能留了口子，放在Growth/goals里了。

![日记型 Agent 的产品定位](/assets/projects/memories-are-diamonds/02-infographic-product-position.webp)

### 产品架构图

![kane_echoes 产品架构图](/assets/projects/memories-are-diamonds/architecture.webp)

### 产品链路图

![kane_echoes 产品链路图](/assets/projects/memories-are-diamonds/product-flow.webp)

## 如何使用

![日记工作流](/assets/projects/memories-are-diamonds/03-flowchart-diary-workflow.webp)

用户操作：

```bash
git clone <repo-url>
cd kane_echoes
npm install
npm run build
npm test
npm run typecheck
```

验收结果：

- 测试通过。
- `dist/cli.js` 可运行。
- 项目目录可以被 Codex、Claude Code、OpenCode 这类 Agent 打开。

### 添加日记

```text
添加今天日记
添加 2026-05-03 的日记
```

会生成模板，然后按照模板填写内容，我没有做成输出内容自动按照模板格式化的原因在于我需要用模板来提醒我应该写什么，也没做成和Agent进行对话的方式，因为对话太浪费时间。

### 完善日记

按照模板填写完之后，所有的事件是松散的，所以需要Agent帮我复盘完善，以便找回当天被遗漏的感受：

```txt
帮我完善今天的日记
```

- Agent 只问 1-5 个问题。
- 问题帮助用户回忆，不审问，不要求完整。
- Agent 不能编造用户没有说过的事件、情绪、人物、健康数据或目标进展。

确认完他的内容之后，就回填日记。

### 生成报告

因为原材料丰富了，所以周报生成的也非常流畅，这块我没遇到什么问题，可能也没那么多讲究，确实周报可以更花哨一点，比如生成漫画、网页这种。这块全凭个人喜好。

![周报生成效果](/assets/projects/memories-are-diamonds/04-infographic-weekly-report.webp)

### 其他功能

因为个人使用习惯的问题，日记出了承担记录的功能，还有一些记录成长和复盘的效果，所以留了些口子：

![周期复盘与成长目标](/assets/projects/memories-are-diamonds/05-framework-cycle-goals.webp)

```txt
// 周期功能
帮我复盘当前周期
这个周期判断成立，写入 cycle
// 成长目标
我想创建一个目标：恢复稳定运动
```

## 设计思路

这个项目最核心的设计原则是：人是主导，AI 补位。

日记和工作日报还是不一样。工作日报的重心在结果，日记的重心在体验。

如果说把工作日报做成全自动流程的产品，我是第一个举双手同意，所以我在办公电脑上开发了个小agent，收集 git log 和 飞书 的文档记录生成 工作日报。
日记不一样的地方在于日记关心的是一个人如何理解自己的一天。它记录的不是任务完成情况，而是当天真实的体验和感悟。

所以 AI 在这里顶多帮我回忆遗漏的细节，其他的就少做甚至不做了。这也是为什么系统里会有三条很明确的边界：

- raw/ 层保存原始记录，AI 不能改写。
- drafts/ 层承接 AI 加工，所有内容都只是候选。
- growth/ 层记录长期判断，必须由用户确认后写入。

这几层看起来像目录结构，实际是在划分权限。
越接近原始体验，越要保留真实；越接近长期判断，越要保留人味。
LLM 负责整理、追问、补全、提醒，但不能越过用户做最终决定。

![三层边界架构图](/assets/projects/memories-are-diamonds/06-framework-three-layers.webp)

这也是我选择纯 Markdown + TypeScript CLI 的原因。不建数据库，不做服务端，不绑定云平台。日记数据是非常私人的长期数据，最稳妥的形态就是普通文件。它可以被人直接阅读，也可以融入 Codex、Claude Code、OpenCode 这类 Agent 工作流。

模板输入也是同一套逻辑。它看起来没有纯对话自然，但更适合日记。因为写日记最重要的动作，不是让 AI 生成一段漂亮文字，而是用户先判断今天什么值得留下。模板会逼我完成这一步：今天发生了什么，我有什么感受，身体状态如何，目标有没有推进，有没有什么关系和场景值得记录。

模板是构图线。用户填进去的关键事件是骨架，AI 后续的完善是血肉补全。

![人机协作流程图](/assets/projects/memories-are-diamonds/07-flowchart-collaboration.webp)

我也不想把它一开始就做成知识库。知识库追求结构化、检索、标签和复用，但日记首先要守住个人的原始体验。日记当然可以被整理，周报、月报、年报也可以生成得很漂亮，但整理应该发生在后面，而不是一开始就把生活压成标签和条目。

它也不是任务管理器。任务管理器关心的是事项是否完成，日记关心的是这一天如何被经历。它可以和目标、周期、成长复盘发生关系，但不能被打卡逻辑吞掉。打卡功能我只留了口子，放在 growth/goals 里，而不是让它变成系统的中心。

全自动日记当然可以做。照片、语音、聊天记录、位置、运动数据都可以接进来，然后每天定时生成一篇日记。这个方向技术上成立，也会显得更像一个完整产品。

但我不想让这个项目变成那样。全自动生成太顺滑了，顺滑到用户可以完全不参与自己的回忆。AI 最后确实会给出一篇总结，可那更像生活数据摘要，不一定是真正的日记。

我更想要的是一种慢一点的人机协作：用户先在输入端完成筛选，提高原始材料的信噪比；AI 再在输出端帮助整理、追问和复盘。这样生成出来的内容不会只是“像一篇日记”，它还保留了用户主动回忆的过程。

![全自动 vs 人机协作对比图](/assets/projects/memories-are-diamonds/08-comparison-automation-vs-collaboration.webp)

## 展望

后面我想强化的是 cycle.md 的作用。cycle.md 可以作为 LLM 的长期上下文锚点。
每次处理 raw/ 或生成 drafts/ 时，AI 不只是问“今天还发生了什么”，而是先对比当天内容和当前周期目标，主动标记偏差。

比如它不应该只问：

```text
当时是不是下雨了？
```

而应该能问：

```text
你今天连续第三天提到精力不足，这和当前周期里“恢复稳定运动”的目标有关吗？
```

让项目从普通的内容补全工具，变成一个带有阶段视角的复盘助手。

但权限边界仍然不变：AI 只能标记、提问、生成候选，不能自动改写 cycle.md。异常检测可以交给 AI，校准决策必须留给人。

![cycle.md 长期上下文锚点图](/assets/projects/memories-are-diamonds/09-infographic-cycle-anchor.webp)

所以这个项目最终想做的，不是替人写日记，而是帮助人把自己的生活重新捡回来。AI 负责降低整理成本，人保留真实体验和最终判断。
