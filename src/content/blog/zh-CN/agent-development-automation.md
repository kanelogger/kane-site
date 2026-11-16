---
locale: "zh-CN"
translationKey: "agent-development-automation"
slug: "agent-development-automation"
translationStatus: "source"
categoryId: "ai-engineering"
tagIds: ["coding-agent", "agent-harness", "multi-agent", "context-engineering"]
title: "Agent 开发自动化"
description: "从项目组织、工具协作到交付流程，梳理 Agent 开发自动化所需的规则、文档、状态与验证方式。"
publishedAt: "2026-11-16"
category: "AI 工程实践"
tags: ["Coding Agent", "Agent Harness", "多 Agent", "上下文工程"]
featured: false
order: 0
author: "Kane"
cover: "/assets/blog/agent-development-automation/cover-47647334bf.webp"
coverAlt: "以文档、工具、代码和检查清单串起 Agent 开发自动化流程"
---

Agent 开发自动化需要清晰的项目组织、可调用的工具，以及可验证的任务流程。先明确规则、文档和状态的分工，再配置工具与协作方式，最后串起从需求到交付的工作流。下面按这个顺序展开，具体做法按项目需要选用。

![Agent 开发自动化信息图：项目组织、工具协作、交付流程和验证要点](/assets/blog/agent-development-automation/infographic.webp)

## 架构分层与项目组织

这里的 Agent 指能够读取资料、调用工具并执行开发任务的 AI 助手。`AGENTS.md` 是项目协作说明的入口；Skill 是按任务加载的操作指南及配套资源；MCP 是接入外部工具与资源的一种协议；CI 是提交或合并时运行自动检查的持续集成流程。

### 职责划分

| 类别 | 维护内容 | 常见载体 |
| --- | --- | --- |
| Agent 角色与入口 | 工作方式、职责边界、规则索引 | `AGENTS.md`、局部规则、角色说明 |
| 稳定规则 | 跨任务适用的工程约束 | `rules/`、代码标准、测试与安全约定 |
| 任务流程 | 推进步骤、阶段转换、完成标准 | 工作流约定、模板、脚本、Hooks、CI |
| 需求与规格 | 目标、输入输出契约、约束、验收标准 | `specs/`、需求文档 |
| 技术决策 | 方案选择的理由、取舍、适用条件 | `docs/adr/`、决策记录 |
| 经验记录 | 实际问题、原因、纠正方法与证据 | `LESSONS.md`、复盘记录 |
| 当前任务 | 范围、计划、进度、阻塞、验收与下一步 | `tasks/`、Issue、PR |

规则入口负责指路，详细内容按任务读取。同一事实只在所属位置维护，其他位置引用它。需求与提案、当前实现、验证结果分别标明：文档能说明约定，源码与配置能确认机制，测试和运行记录才能支持特定场景下的实际结果。

![项目入口、知识文档和任务状态各自承担不同职责](/assets/blog/agent-development-automation/project-roles.webp)

每条关键规则应明确适用场景、执行主体和检查方式。可确定性验证的约束进入脚本、测试或 CI；需要语义判断与取舍的约束进入审阅清单。对反复误用且替代方案明确的用法，可以通过 lint 或 API 边界限制。

![Agent 开发自动化参考架构：共享上下文、执行验证、独立审阅与交付复盘](/assets/blog/agent-development-automation/architecture.png)

### 目录示例

下面以一个前后端分目录的全栈项目为例。目录名和拆分粒度可按技术栈与规模调整，小项目可以合并文档，职责稳定后再拆分。

```text
project/
├── AGENTS.md                 # 项目说明与规则入口
├── .agents/
│   ├── skills/               # 技能及配套资源
│   └── state/                # 可选的本地运行状态，通常不入库
├── docs/
│   ├── subsystems/           # 当前实现说明与源码入口
│   │   └── README.md         # 子系统索引与维护约定
│   ├── adr/                  # 技术决策
│   └── agent-environment/    # 环境与命令指南
├── LESSONS.md                # 经验与复盘记录
├── rules/                    # 稳定工程约束
├── specs/                    # 需求与规格
├── tasks/                    # 当前任务
├── frontend/                 # 前端代码
├── backend/                  # 后端代码或对应平台的实现目录
└── scripts/                  # 可重复执行的工程流程
```

业务代码也可放在 `src/`、`internal/`、`packages/` 等位置；测试随模块维护或集中组织。验证入口应能从项目规则或环境指南找到。

## 工具与协作

### 工具选择

- Coding Agent：[omp](https://kanelogger.github.io/my-reports/reports/OMP%E5%AE%8C%E5%85%A8%E6%8C%87%E5%8D%97.html)、Codex、Cursor。
- 开发工具：[magpie](https://mp.weixin.qq.com/s/vCDWWogKSCgGKRojT20Jng)；[RTK](https://www.rtk-ai.app/docs/getting-started/quick-start/) 过滤和汇总命令输出，适合测试、Git、构建输出较大的场景，可在 magpie 中设置。
- Agent 协作：[herdr](https://herdr.dev/guide/)，用于桥接不同 Agent。
- 移动端启动：workbuddy、网易 UU、tailscale。

herdr 的使用指令示例：

```sh
# 刚开始
读取 ~/.config/herdr-app/AGENTS.md，告诉我你能做什么、不能做什么。

在当前项目、当前环境起一个 review agent，把它发现的问题告诉我。

为 {plan} 开一个 work，在上面启动 implementer agent，把任务交给它。
```

### 独立审阅

我会保持 review 和 plan do agent 采用不同的模型和agent。保持异构。共有背景文件，但是独立会话，这样一方不会被另一方带偏。

这个方法论源自于一篇关于 LLM 自我纠正的论文《When Can LLMs Actually Correct Their Own Mistakes?》，这篇论文的结论是：如果没有可靠的外部反馈（测试结果、工具输出等），模型仅靠自己反思很难稳定纠正错误。换句话说就是：review 的价值就在于有新增的上下文信息，比如新的方法论（应该怎么改）或者额外信息，让 Agent 获得新的注意力方向和额外计算预算。

## 从需求到交付的工作流

项目组织与协作方式确定后，单次任务可以按以下步骤推进，各阶段的技能按需调用：

![从需求澄清经过方案、规划、开发验证与交付到清理复盘](/assets/blog/agent-development-automation/workflow.webp)

```text
需求澄清 → 原型与方案 → 执行规划 → 开发与验证 → 提交交付 → 清理复盘
```

### 开始前：接入项目

- [kane-agent-bootstrap](https://github.com/kanelogger/kane-skills/tree/main/skills/engineering/kane-agent-bootstrap)：根据已有项目的业务、技术栈和协作约定，合并 Agent 开发入口与环境声明，准备并验证实际开发环境。适合首次接入或修正已有接入，普通功能开发无需重复初始化。

### 需求澄清与调研

- [requirement-explorer](https://github.com/kanelogger/kane-skills/tree/main/skills/planning/requirement-explorer)：引导业务专家梳理业务对象、功能、规则、流程和岗位权限，生成需求文档。未确认事项保留为草稿；UI、数据库、API 和架构设计留给后续环节。
- [kane-clarify-questions](https://github.com/kanelogger/kane-skills/tree/main/skills/planning/kane-clarify-questions)：用少量具体问题补齐目标、约束和交付要求，区分事实、假设和未确定事项。需要时点名调用，不代替完整的软件需求访谈。
- [github-reuse-scout](https://github.com/kanelogger/kane-skills/tree/main/skills/planning/github-reuse-scout)：搜索并检查可作开发基座的 GitHub 项目，决定直接复用、参考架构或从零开发，将依据和渐进迁移计划写入 `.reuse/reuse-plan.md`。复用时可继续负责启动和迁移，不用于单个依赖库或代码片段的搜索。

### 原型与方案设计

- UI：[impeccable](https://github.com/pbakaus/impeccable)，提供设计规范和改稿方法，优化字体、配色、层级与留白。
- 架构图：[architecture-diagram](https://github.com/Cocoon-AI/architecture-diagram-generator)，生成深色主题、自包含的 HTML+SVG 架构图，适用于系统、基础设施、云、安全或网络拓扑。

impeccable 的指令示例：

```text
/impeccable {shape} 优化 UI。以 Awwwards、Webby Awards、FWA 获奖作品为质量参照，自行检查并反复改进；需要设计参考时，查阅相关网站。
```

### 执行规划

- [kane-task-planner](https://github.com/kanelogger/kane-skills/tree/main/skills/planning/kane-task-planner)：拆分主要环节，建议哪些直接完成、使用脚本、交给子代理或复用 Skill，并明确产出和依赖。需要时点名调用，只交付粗粒度计划，不执行任务、派发子代理或创建技能。

规划结果写入任务入口，作为实施、验证和交付的依据。

### 开发与验证

由 Coding Agent 按计划实现，并运行相关测试与构建检查，再由独立审阅者检查改动。

![开发后进行验证与独立审阅，发现问题则修复并重新验证](/assets/blog/agent-development-automation/review.webp)

需要降低维护负担时，可在本阶段简化代码：

- [simplify-codebase](https://github.com/kanelogger/kane-skills/tree/main/skills/engineering/simplify-codebase)：检查死代码、重复状态、冗余 API、过度分层和过期兼容逻辑。审计模式给出有证据的候选；变更模式在授权范围内删除或合并，并验证需保留的行为。

修复问题或简化代码后，重新验证受影响的部分。交付前，沿真实用户路径验证关键操作及结果，可按运行环境选用以下工具：

- [browser-skill](https://github.com/Tencent/BrowserSkill/) 与 [ego lite](https://lite.ego.app/zh-cn)：用于浏览器操作。
- agent-desktop：用于桌面环境操作。

验证记录应关联对应版本、环境和执行范围，分别说明测试、构建、实际运行和验收结果，并标明未覆盖项。

### 提交交付

- [git-commit-push](https://github.com/kanelogger/kane-skills/tree/main/skills/engineering/git-commit-push)：只提交当前任务的改动，生成 Conventional Commit。快捷模式依据 diff 写提交信息；全面模式复核改动，记录原因、已有验证和回滚方法；深度模式额外审查相关代码并运行必要检查。另行选择“仅提交”或“提交并推送”。

交付说明应写清受影响子系统的触发条件、变更前后可观察的行为，并关联所属文档、实现和验证记录，供审阅者核对。

### 清理复盘

- [kane-task-cleanup](https://github.com/kanelogger/kane-skills/tree/main/skills/engineering/kane-task-cleanup)：收尾时显式调用，核实归属和依赖后清理本次任务的一次性临时文件，保留交付物、正式测试及复现资料。可指定“先看清单”或“只保留成果”，执行后回读实际状态。
- [kane-task-retro](https://github.com/kanelogger/kane-skills/tree/main/skills/engineering/kane-task-retro)：核对结果是否符合预期，再找最值得改的低效点，提出一条可在下次任务验证的建议。默认在对话中交付复盘卡，不自动实施建议。

### 使用技巧
1. 控制上下文。同一任务历史过长`/compact`、阶段结束，由新会话接手`/handoff`、探索另一个方案`/fork`。为什么控制上下文？幻觉和截断，语义的坍缩。
2. 每纠正 AI 一次，就把这次纠正写成 lint 这类自动检查规则，少往 agents.md 这类说明文档里加话。违反 lint 规则的代码会直接报错、提交不上去，文档里的话 AI 不一定照做。
3. 代码库是 AI 最主要的学习材料。里面的坏写法、临时补丁，会被下一个 AI 当成惯例照抄，像杂草一样越长越多，所以代码库要保持干净。
4. 容易用错的东西，直接禁掉。React 里有个功能人都常用错，AI 更用不好，直接在代码里禁用它，这类问题从此不再出现。
5. 禁掉 99% 的代码注释。AI 爱在注释里给自己走的捷径找理由，后来的 AI 就照着学。她在 Cursor 时，这种“有理由的补丁”扩散开来，把应用拖得很卡。
6. 先打好地基，再谈全自动。AI 写代码这一步本身出烂代码的话，全自动化只会出更多烂代码，还更费钱。

### 猜你喜欢
- context-mode
- headroom
- [archify](https://github.com/tt-a1i/archify) 把系统架构、流程、时序、数据流与状态图做成可探索的独立 HTML（内联 SVG），支持深浅色、可选动效与多种导出；也可美化或转换 Mermaid。
- https://github.com/cathrynlavery/diagram-design
