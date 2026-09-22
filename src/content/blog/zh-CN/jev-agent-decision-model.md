---
locale: "zh-CN"
translationKey: "jev-agent-decision-model"
slug: "jev-agent-decision-model"
translationStatus: "source"
categoryId: "ai-technology"
tagIds: ["ai-model", "jev", "agent", "decision-model", "typesafe"]

title: "一文看懂 Jev：一种面向 Agent 的快速决策模型"
description: "TypeSafe 的 Jev 是面向 Agent 的决策模型，通过 Choice、Score、Noul 三类接口直接返回固定类型与概率，适合高频、选项可枚举的单步判断。"
publishedAt: "2026-09-21"
category: "AI 技术"
tags: ["AI 模型", "Jev", "Agent", "决策模型", "TypeSafe"]
featured: false
order: 0
author: "Kane"
cover: "/assets/blog/jev-agent-decision-model/cover.webp"
---

> 它怎样工作、如何接入，以及适合放进哪些 Agent 工作流

搭建 Agent 时，我们经常让通用大模型反复决定下一步：选哪个工具，这条消息交给谁，这份结果是否值得保留。许多判断只有几个固定答案，并不需要模型生成一段完整文字。

Jev 就是为这类任务设计的。它是 TypeSafe AI 在 2026 年 9 月推出的决策模型。开发者提供当前状态、问题和允许的答案，Jev 返回程序可以直接使用的选择、评分或概率。TypeSafe 把这类模型称为 System One 模型。

可以把 Jev 理解成软件里的「智能判断函数」：模型理解输入并作出判断，普通代码负责执行结果。

下面两张 meme 展示了它的基本思路：少生成文字，直接作出选择；把一段对话拆成意图、风险和下一步动作。

![用长篇表达与按铃选择对比 LLM 和 Jev 的 meme](/assets/blog/jev-agent-decision-model/01-meme.webp)

![把聊天内容拆成意图、风险和动作选择的 Jev 示意 meme](/assets/blog/jev-agent-decision-model/02-meme.webp)

## Jev 是怎样做判断的

### 给它状态和问题，拿回固定类型的答案

一次调用包含两部分：**状态（state）**和**问题（questions）**。状态提供共同背景，例如一条客服消息或一组搜索结果；问题规定要判断什么，以及可以返回哪些结果。

Jev 提供三类接口：

| 类型 | 问什么 | 返回什么 |
| --- | --- | --- |
| Choice：选择 | 这条消息应该交给哪个团队？ | 一个选项、各选项的概率，以及 `confidence` |
| Score：评分 | 这段内容的风险处于哪个等级？ | 按定义的等级评分、概率分布，以及 `confidence` |
| Noul：是非判断 | 这条请求需要转人工吗？ | 「是」的概率，取值为 0～1，不单独返回 `confidence` |

三种问题可以放在同一次请求里。例如，面对一条「付款失败，多次重试都没用」的客服消息，可以同时判断负责团队、情绪等级和是否需要升级处理。它们读取同一份状态，各自返回结果，再由业务代码决定后续流程。[接口介绍](https://docs.typesafe.ai/introduction)

![同一状态下的 Choice、Score、Noul 三类判断结构](/assets/blog/jev-agent-decision-model/01-infographic-typed-answers.webp)

### 游戏例子：Jev 选动作，程序执行动作

以一个简化游戏为例，可以把当前局面描述给 Jev：

> 当前血量、怪物和金币的位置、出口的位置如下。目标是拿到金币并活着出去，现在应该按哪个键？

可选项提前定义为：**上、下、左、右、攻击、喝药**。Jev 返回一个动作，游戏程序执行后再更新局面。

Jev 只负责选择动作。游戏程序仍负责移动、战斗和更新状态。网页任务也是如此：代码提供候选结果，Jev 协助选择，执行模块完成后续操作。

接口不会返回第七种动作，但 Jev 仍可能在应该喝药时选择攻击。**输出符合约定，不等于判断正确。**

这个例子只说明单步选择。需要绕路、回溯或连续规划的任务，不能靠重复调用 Jev 自动获得可靠的全局方案。

![Jev 选游戏动作、程序执行并更新状态](/assets/blog/jev-agent-decision-model/02-flowchart-game-loop.webp)

### 为什么值得把这一步单独拿出来

用通用大模型做分类时，我们通常要求它生成标签或 JSON，再交给程序解析。TypeSafe 对 Jev 的公开描述是直接并行输出概率，省去逐个生成输出 token 的过程。

如果任务只是从三个队列中选一个，生成队列名称、标点和解释会增加额外工作。Jev 把接口收窄到判断本身：模型给出结构化结果，普通代码负责后续分支。

调用量小时，这点差别未必明显。一个任务需要几十次判断或同时服务大量用户时，每次调用的延迟和成本会逐渐累积。把针对同一份状态的独立问题合并到一次请求里，还可能减少重复调用。

![通用 LLM 生成路径与 Jev 有限选择路径对比](/assets/blog/jev-agent-decision-model/03-comparison-llm-jev.webp)

Jev 也不是所有判断任务的默认选择。可以先按下面的方式选择方案：

| 方案 | 适合什么问题 | 主要优势 | 主要限制 |
| --- | --- | --- | --- |
| 规则代码 | 条件明确、边界稳定 | 快、便宜、结果确定 | 难以处理含义模糊的自然语言 |
| 普通分类模型 | 有足够标注数据、类别长期稳定 | 可针对固定任务优化 | 通常需要训练、部署和维护 |
| 通用 LLM | 需要解释、生成或多步推理 | 能处理开放问题 | 输出解析、延迟和成本通常更高 |
| Jev | 输入含义模糊，但答案可以提前枚举 | 直接返回固定类型和概率 | 仍会误判，也不负责复杂规划 |

规则能写清楚时，优先使用普通代码。Jev 更适合自然语言边界模糊、输出范围明确，并且需要频繁调用的判断任务。

## 如何使用

### 先跑通一个具体判断

可以按下面的顺序上手：

1. 前往 [TypeSafe 官网](https://typesafe.ai/) 注册或申请访问资格。
2. 在 [Playground](https://console.typesafe.ai/playground) 放入一条真实业务样本，测试一个 Choice、Score 或 Noul 问题。
3. 在控制台创建 API Key，供本地程序调用。
4. 给 Codex 等 Coding Agent 安装官方 TypeSafe Skill，并提供输入样本、允许的输出和不确定时的处理方式。

官方提供的通用 Skill 安装命令是：

```bash
npx skills add typesafe-ai/skills --skill typesafe-ai
```

按提示选择正在使用的 Agent。默认安装到当前项目；完整说明见 [Agent Skill 文档](https://docs.typesafe.ai/agent-skill)和 [Skills 仓库](https://github.com/typesafe-ai/skills)。

例如，可以这样描述第一个接入需求：

> Use the TypeSafe skill。把客服消息按支付、账户、其他三个队列分类，同时判断是否需要人工升级，并按我给定的等级评价用户情绪。让业务代码读取这些结果；信息不足时转人工处理。

接入后，还要用自己的样本验证分类效果和处理策略。

![从业务样本到历史验证的 Jev 上手路线](/assets/blog/jev-agent-decision-model/04-flowchart-first-decision.webp)

### 官方 API、SDK 和聚合平台

直接接入可以从[官方文档](https://docs.typesafe.ai/introduction)和[快速开始](https://docs.typesafe.ai/introduction/quickstart)进入。官方支持 HTTP API、Python SDK 和 JavaScript SDK；HTTP 接口为 `POST https://api.typesafe.ai/v1/systemone`。

截至 2026 年 9 月 21 日，官方发布说明与 OpenRouter 的 Jev 1.13 页面列出的价格为：**输入每百万 token 0.042 美元，输出免费**。不同入口可能有独立促销和计费安排，接入时应确认所用渠道的价格。[官方价格说明](https://typesafe.ai/blog/introducing-system-one-models-and-jev)、[OpenRouter 模型页](https://openrouter.ai/typesafe/jev-1.13/)

已有聚合层的项目，也可以查看以下入口：

| 入口 | 当前页面中的模型标识 | 接入时需要注意 |
| --- | --- | --- |
| [OpenRouter](https://openrouter.ai/typesafe/jev-1.13/) | `typesafe/jev-1.13` | 这是具体版本标识，按平台的决策模型说明构造请求 |
| [Vercel AI Gateway](https://vercel.com/ai-gateway/models/jev) | `typesafe-ai/jev` | 页面示例使用 AI SDK 的 `experimental_evaluate`，传入状态和问题 |

这些入口提供了不同的接入方式，但普通聊天请求与决策请求的数据结构不同。迁移时需要同时检查调用方法、问题定义和结果读取方式。

### 接入的关键：把问题拆对，再合并请求

先定义一份共享状态，再列出能够独立回答的问题。客服消息的团队归属、情绪等级和升级需求可以一起判断。每个问题只负责一个维度，优先级和结果组合方式由代码明确表达。

选项也要写清楚。「风险高不高」过于模糊。如果使用 Score，应为每个等级定义判断标准。分类标签之间要能区分；如果输入可能缺少信息，可以在 Choice 中增加「无法判断」或「其他」，并安排对应处理。

还要区分独立问题与依赖问题。同一请求中的问题各自读取状态，不会自动取得其他问题的答案。如果第二个判断依赖第一个判断，例如先选择负责团队，再按该团队的规则分配处理方式，就应由程序分成两个阶段。[问题组合说明](https://docs.typesafe.ai/introduction)

![独立问题并行与依赖问题分阶段的工作流](/assets/blog/jev-agent-decision-model/05-framework-parallel-stages.webp)

## 案例：把 Jev 放进 Agent 工作流

### fast-jev-compaction：判断哪些上下文还值得保留

Coding Agent 运行长任务时，会积累文件读取、搜索结果和工具日志。[fast-jev-compaction](https://github.com/tamaratran/fast-jev-compaction) 利用 Jev 判断哪些工具调用仍有保留价值，再由程序保留、截短或删除相应内容。这样可以少改写精确信息，但也可能误删后续任务需要的证据。该项目主要处理工具调用及其结果，对普通对话的压缩空间可能较小。

### Jev Codex Router：先分流，再调用合适的模型

[Jev Codex Router](https://github.com/0xNatoshi/jev-codex-router) 在模型调用前使用 Jev，根据任务选择模型档位和思考深度。它曾公布约 60% 的成本降幅，但[回测说明](https://github.com/0xNatoshi/jev-codex-router/blob/main/BACKTEST.md)显示，这只是旧版策略对 7 天、237 轮历史任务重新计价的模拟结果。它没有证明替换模型后任务质量不变，也不能代表当前策略的实际收益。计算路由收益时，还要计入错误分流造成的返工、延迟和失败。

### 工具选择：从明确的候选列表里挑下一步

在复杂 Agent 中，可以把当前任务、必要上下文和工具用途交给 Jev，让它从有效列表中选择下一步。固定候选项可以避免返回不存在的工具名，但选中的工具仍可能不适合当前任务。参数校验、权限检查和执行结果处理仍由外围程序负责。同样的方法也适用于工单路由、文档打标和推荐候选选择。

![从候选工具到程序校验和执行的安全链](/assets/blog/jev-agent-decision-model/06-flowchart-tool-selection.webp)

### 置信度门禁与安全护栏：让不确定的判断有去处

同一个判断可以有多条处理路径：结果足够可靠且符合业务规则时自动处理；信息不足时补充上下文或交给更强的模型；难以判断或错误代价较高时交给人工。安全护栏也可以定义为一个 Choice 问题，返回 `Allow`、`Deny` 或 `Ask`，再由程序执行相应策略。

这种接口便于集成，但能否识别危险请求仍要通过评测确认。不能看到 `confidence` 高于 0.9 就允许执行代码；阈值需要结合错误代价、模型表现和业务规则制定。[官方置信度使用说明](https://docs.typesafe.ai/confidence)

![confidence 结合业务规则与错误代价的处理门禁](/assets/blog/jev-agent-decision-model/07-framework-confidence-gate.webp)

## 用之前，先理解它的边界

### 「零幻觉」能说明什么

TypeSafe 所强调的类型安全，是指结果符合调用者预先定义的输出约束。从 `payments`、`account`、`other` 三个选项中选择时，输出范围可以固定，程序不必处理模型临时编出的第四个标签。[官方对 schema 保证的说明](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

但 Jev 仍可能把支付问题分给账户团队，也可能误判讽刺、风险和用户意图。限定输出只解决接口可靠性的一部分，分类准确率和误判代价仍要单独评估。

### 概率、confidence 和校准是三件相关的事

`probabilities` 表示各候选结果的预测概率。Choice 和 Score 中的 `confidence` 由这份概率分布计算，用一个数字概括分布的集中程度。它不是独立预测的「答对概率」，也不能与最高候选概率混用。Noul 直接返回「是」的概率。[字段定义](https://docs.typesafe.ai/confidence)

例如，某个候选项的概率为 0.8，表示模型把较多概率分配给它。要判断这个数值是否可信，需要检查大量类似预测：概率约为 0.8 的结果，最终是否约有 80% 成立。这就是校准。单次判断的成败不能证明模型是否校准。

TypeSafe 把自己的后训练方法称为 RLCD，即校准决策强化学习，目标是让概率与结果相符。实际表现仍要通过数据检验。[官方 AI Primer](https://docs.typesafe.ai/introduction/machine-learning-primer)

### 用业务样本检验稳定性、延迟和成本

先测准确率和错误类型，再观察概率与真实结果是否匹配。业务输入发生变化后，数据分布也可能变化，原先合适的阈值需要重新检查。

候选项的写法和顺序也要测试。Archer Hume 的[黑盒研究](https://archerhume.com/posts/jevs-architecture-unmasked/)发现，改变候选顺序或增加无关选项，可能改变原有选项的概率。这是对特定模型版本的观察，可以提醒开发者检查决策是否对这些变化过于敏感，但不能证明模型采用了某种内部架构。

延迟和成本也要放在完整工作流中测试。官方曾给出 70～500 毫秒的端到端响应范围，并展示特定工作流中的收益，同时说明测试环境与对比方式会影响结果。网络、输入长度、问题数量、回退比例和后续返工都可能改变实际收益。[官方性能说明与限制](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

对真实系统而言，关键指标是任务能否完成、需要多久、总成本是多少，以及失败后如何恢复。这些指标比单次模型调用速度更能说明使用价值。

## Jev 适合解决什么问题

分类、概率输出和并行处理并不新鲜。Jev 的特点是把自然语言理解、固定类型的结果和概率接口组合成一个容易嵌入程序的判断组件。

Jev 适合单步、结构化的判断，不负责复杂规划。以下任务不应只靠 Jev 自动完成：

- 需要绕路、回溯或多步规划的任务，例如迷宫、装箱和调度；
- 一次错误就可能导致严重后果的连续控制，例如自动驾驶；
- 不可逆或代价很高的操作，例如删除数据、执行事务和其他需要审计的操作。

这些任务可以使用 Jev 辅助判断，但仍需要规划模型、业务规则、权限控制或人工确认。

适合优先尝试的任务通常有五个特点：输入可以表示为文本或结构化状态；输出可以提前枚举；调用频繁；有真实结果可供核验；选错后有明确的处理办法。开放式写作、复杂规划和长篇论证应交给具备相应能力的模型。处理原始图像或音频前，还需要先完成感知和状态转换。

如果判断足够便宜、足够快，软件可以在更多节点使用它。Jev 的名字取自 William Stanley Jevons，借用了杰文斯悖论的寓意：效率提升后，总使用量可能随之增长。[命名说明](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

在现有 Agent 中，可以先选择一个「高频、有限选择、结果可核验」的节点，例如工单分流或工具选择。用历史样本比较准确率、延迟和完整成本，验证阈值与回退策略，再逐步扩大自动执行范围。

![Jev 一页看懂：工作方式、适用任务与验证边界](/assets/blog/jev-agent-decision-model/infographic.webp)
