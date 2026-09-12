---
locale: "zh-CN"
translationKey: "learning-pi-in-practice"
slug: "learning-pi-in-practice"
translationStatus: "source"
categoryId: "ai-programming"
tagIds: ["pi", "coding-agent", "harness", "context-engineering"]

title: "学 Pi 不是难，是顺序搞反了"
description: "按实践优先的顺序学习 Pi，并以三层 Harness 和分页搜索控制上下文成本。"
publishedAt: "2026-08-31"
category: "AI 编程"
tags: ["Pi", "Coding Agent", "Harness", "上下文工程"]
featured: true
order: 3
author: "Kane"
featuredOrder: 3
---

其实 Pi 没有想象的那么难，只是大多数人一开始学习的方向就错了：

一上来研究 Harness、Agent Loop、Extension 这些架构，收藏夹放得满满当当，电脑里却空空如也。

正确顺序是

先动手、用熟了再理解，最后才玩组合。

很多人把顺序搞反，是先把 Pi、Pi Coding Agent、Claude Code、Codex 的关系理清楚再开始——其实你只需要知道 Pi 最大的特点就是足够轻，而且很多能力都可以自己往上加，剩下的一边用一边就懂了。

跟着下面五个步骤，一天就能上手。

## 当天只做开通

去 https://pi.dev 按官方方式装，不要先搜第三方教程。

装完先配一个你有额度的模型，新建 Session，丢一件真事进去：改一个函数、写个脚本、排查一段报错。能跑通、能打断、能续上，这一步才算过。先让 Pi 真正进入你的日常工作，而不是装完以后就开始研究源码。

## 把基本操作摸成肌肉记忆

记这几个就够：新建 / 切 Session、继续上次任务、`/scoped-models` 把常用模型收成短名单、`Ctrl+P` 切换。先固定一个主力模型，别一天换五个。

任务没结束别新开一堆窗口，上下文会散。

## 加能力只加你会重复用的

先写或装 Skill：把「每回都要交代一遍」的流程写进 `SKILL.md`。

再装 Extension：SSH、安全拦截、上下文查看。Skill 是说明书，扩展才改运行时。

装包用 `pi install`，去官方文档和插件市场搜，群里复制的命令先别用。MCP 先放下。这一步基本也是 Pi 最好玩的阶段。

## 等窗口满了再调 Context

连续做一件稍长的事，看 Token、缓存、Compaction 什么时候开始工作。

这时再懂为什么 Pi 的 System Prompt 很短、工具很少、缓存容易命中，以及上下文满了以后 Compaction 到底在干什么，比一开始硬啃概念容易很多。

爆过一次再决定要不要加压缩、要不要切轻量模型，比先背概念有用。

## 稳定一周后再玩组合

日常已经离不开，再试手机远程、多设备协同、Sub-agent、多模型分工——一个模型写、一个模型审，甚至慢慢组合出一套属于自己的 Pi。

先单会话做熟，再并行。并行以前先想清楚：谁负责写、谁负责看、结果放哪，不然只是多开几个窗口。这时候你才会真正理解为什么很多人把 Pi 当成 Harness，而不只是另一个 Coding Agent。

> 学习 Pi 难的不是理解，而是开始动手，只有真正操作和学习，你才能掌握它。

学习网站，我只推荐一个：https://pi.dev/docs/latest
---

## 三周后，我把 Harness 搭成了自己想要的样子

把主力 Coding Agent 从 Claude Code 切到 Pi 已经三周多，最直观的感受不是 Pi 有多厉害，而是终于能搭一套属于自己的 Harness，效率高了不止一点。

Pi 的缓存命中经常跑到 98% 以上，连续对话确实快（CH == cache hit）。但这只是结果。真正拉开差距的是，我终于能自己决定 Agent 怎么工作：哪些规则常驻、哪些能力按需加载、哪些任务丢给子 Agent、什么情况下必须停下来问我。

## 为什么换掉 Claude Code

Claude Code 很好用，开箱即用。但用久了会发现，它不好调：上下文和验证跟着产品走，子 Agent 怎么分工不透明，任务一复杂就看不清它为什么这么拆、结果又被谁用掉了。还有就是，它会夹带私货，为了限制第三方 API 设了不少关卡（太阴了）。

Pi 最近热度很高，相信大家也受够了重重的 Harness，不如一起来搭属于自己的 Pi。我想要的 Coding Agent 其实就几件事：读改代码、跑 Shell、加载项目规则、按需叫 SubAgent、改完能验证。Pi 刚好把核心做得很小，其他都交给你自己拼。门槛是高了一点点，但也让我第一次把 Harness 搭成了自己想要的样子。

## 我的 Harness 分三层

不是装得越多越强，我现在就分三层。

### 第一层：AGENTS.md，管纪律

全局一份，项目级一份，写的都是不怎么变的东西：改前先看结构和调用路径，只做必要改动，不顺手重构，需求模糊先提问，改完跑最相关的测试，最后看 diff。不确定就说假设。Agent 启动就拿到，不用每轮重写进 Prompt。

### 第二层：Skills，管能力，按需加载

我常驻的就几个：`tdd`、`diagnosing-bugs`、`code-review`、`research`，再加上一个自己写的管并行的 `parallel-agent`。一个 Skill 只管一种活，需要时再展开。堆多了反而容易路由错，不常用的用 pi-skillful 直接隐藏掉，上下文十分干净。

### 第三层：Packages，管控制面

这层是我想重点聊的。我全局装了 10 个，常用的都在下面：

1. pi-subagents：整个并行调度的底座。所有多 Agent 都走 workflowScript，`runs.all` 跑独立 lanes，`runs.run` 跑串行阶段，`fresh` 隔离上下文，父 Agent 负责汇总和拍板。没有它，其他都是散的。
2. pi-skillful：管 Skills 的发现和加载。支持从仓库外层继续发现 `.agents/skills/`，支持 `$` 显式展开，也支持把不常用的 Skill 隐藏，避免全部塞进系统提示词。我现在就隐藏了 10 个简历和 PPT 相关 Skill，需要时再切出来。
3. @eko24ive/pi-ask：在歧义处停下来。目标文件、改原文还是新建、验收标准不明确时，用结构化的 `ask_user` 先问清选项。听起来不像效率功能，但少一次推倒重写就赚回来了。
4. pi-simplify：只盯最近改动。扫重复和不必要的复杂度，不借 review 名义重构整个项目。
5. @zigai/pi-mention-skill：把 Skill 调用从 `/` 改成 `$`。输入 `$` 就能模糊搜 Skill 并展开到当前 Prompt，Skills 不用常驻也能随用随取。
6. @tavily/pi-extension：给 researcher 加联网能力。`web_search` 先找，`web_fetch` 再抽正文，查资料和改代码分在不同 Agent 里，错误更好定位。
7. @narumitw/pi-goal：管长目标的 `/goal`。给 session 一个显式目标，跑到完成、阻塞或等待外部事件才停，有 `goal_complete` / `goal_blocked` / `goal_wait` 三把闸，不让循环空转。
8. pi-context-usage：看 Context 烧到哪了。`/context` 给点阵图，`/context details` 展开 system prompt、工具和对话轮次的占比，快满了先做 compaction 或换 lane。
9. @narumitw/pi-btw：开侧边线程。`/btw` 问临时问题，不污染主对话，答案只在需要时带回主线程。调 API 命名、查一段报错时很好用。
10. @ff-labs/pi-fff：换掉 find / grep。基于 Rust 的 FFF，常驻索引、frecency 排序、git 感知，不用每次起子进程。找文件和扫代码的体感是最明显的，下面这节单独展开。

---

## 进阶：把塞垃圾的 grep 换掉

用熟了之后，你大概率会遇到这个问题：你的 Pi 正在用 grep 往 Context 里塞垃圾。

pi 内置的 grep 其实就是 `rg --json` 套壳，limit 100 + 截断 50KB + 默认带 `--hidden`，搜一次 TODO 这种高频词，直接 30 多条平铺甩进上下文。Token 烧了，关键文件还被埋在后面。这个问题 Codex 早就用优化过的 rg 解决，pi 这边最干净的解法我测下来是 `@ff-labs/pi-fff`。

它不是再包一层 rg，而是把 FFF 这个 Rust 原生库直接接到 pi 里，不起子进程，文件在后台预索引。核心变化就三点：frecency 排序常用文件自动置顶、git-aware 改动过的文件加权、grep 结果分组 + cursor 分页。

## 实测对比

我测了一下，本地建了个小项目 `src/app.ts` / `utils.ts` / `README.md`，往 `noise.ts` 里塞了 30 行 TODO fix，总共 33 个命中。

用内置逻辑等价于 `rg "TODO"`，33 行平铺一次性返回。换成 `ffgrep`：

- 第一页只给 20 条，全是 `noise.ts` 分组好的 1-20，还带一句 `[Continue with cursor="fff_c1"]`。
- 第二页 `ffgrep cursor="fff_c1"` 才吐剩下 13 条，`app.ts` 和 `utils.ts` 被分在后面，首屏完全不淹没。

`fffind` 也一样，`fffind pattern:"app"` 直接模糊命中 `src/app.ts` 和 `README.md`，frecency 会把你最近改过的文件排前面，不用写 glob。

## 安装就一行，不用装 rg/fd 二进制

> `pi install npm:@ff-labs/pi-fff`

装完 reload 就有 `ffgrep` / `fffind` / `fff-multi-grep`。默认是 `tools-and-ui` 额外加工具，想直接替换掉内置 grep 就切 override 模式：`PI_FFF_MODE=override` 或启动加 `--fff-mode override`。

## 为什么选它不选别的

我扫了一遍 pi 插件库同期数据，`@ff-labs/pi-fff` 周下载 6,830 / 月 33,928，版本 0.10.5，已经 80+ 个 nightly 迭代，是搜索类最成熟的。对比 `pi-lean-grep` 周下载才 4，`pi-hypa` 是做压缩的，定位不一样。

## 体感变化

默认 `ffgrep` limit 20 对比内置 100，首屏噪音直接砍掉 80%。配合 cursor，你是「精准定位再 read」，而不是「先把 50KB 塞进 Context 再让模型自己找」。`/fff-health` 还能看索引和 frecency 状态。

说真的，pi 默认 4 个工具 `read, bash, edit, write` 之外，`grep/find` 本来就得显式启用，既然要开，不如直接开这个。

已经在用 pi 写代码、被 grep 刷屏搞崩过 Context 的人可以试试，尤其大仓、TODO / FIXME 满天飞的项目，提升最明显。

推荐大家在 pi 里试试 https://pi.dev/packages/@ff-labs/pi-fff
