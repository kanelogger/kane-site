---
locale: "en"
translationKey: "ai-native-development-system"
slug: "ai-native-development-system"
translationStatus: "reviewed"
categoryId: "ai-programming"
tagIds: ["ai-native-development", "coding-agent", "software-engineering", "feedback-loops"]

title: "The AI-Native Development System"
description: "Use the repository to hold facts, process, state, and experience, then control agent risk with runnable slices, hard gates, and feedback loops."
publishedAt: "2026-08-02"
category: "AI Programming"
tags: ["AI-native development", "Coding Agent", "Software Engineering", "Feedback loops"]
featured: true
order: 5
author: "Kane"
featuredOrder: 4
cover: "/assets/blog/ai-native-development-system/cover.webp"
---

**AI can now generate code faster than a person can read it.** Treating line-by-line comprehension as the main quality control method only makes the human reviewer fall further behind.

The problem is not just generation speed. At the beginning of every session, an agent must reconstruct what the project is, where the work stopped, which decisions are confirmed, what it may do, and what it must not do. If those facts live only in a conversation or in someone's memory, a faster model also drifts faster.

An AI-native development system therefore needs two interlocking loops:

1. **The context loop** writes rules, specifications, state, and past decisions into the repository so a cold-start agent can recover its working context.
2. **The execution loop** turns requirements into executable facts, delivers small runnable versions, and controls risk with real feedback, stage gates, and rollback.

The first loop tells the agent how to work. The second proves whether the result works. **Only together do they turn generation speed into productivity instead of an uncontrolled multiplier.**

The context loop records which project facts are currently valid. The execution loop records task relationships: dependencies, allowed transitions, parallel work, recovery points, and human approval gates.

![The two loops of AI-native development](/assets/blog/ai-native-development-system/01-ai-native-two-loops.webp)

![System architecture overview](/assets/blog/ai-native-development-system/architecture-diagram.webp)

## 1. Treat the model as an approximately stateless function

Design the project with one useful engineering assumption: **the model is approximately stateless**. Do not depend on it remembering a previous session or on an informal “we agreed earlier”. Every call should be able to reconstruct the task from the material currently visible to it.

That assumption changes the repository's job. **The repository is both source code and the agent's operating environment and long-term memory.** It should have a readable, traceable home for:

- the project identity and technology stack;
- each directory's responsibility;
- the current requirement stage;
- confirmed specifications and contracts;
- files and rules to read before changing a module;
- commands used for validation;
- decisions that still apply and decisions that have been superseded;
- actions that require a human to approve them.

These capabilities usually live in four layers:

| Layer | Question it answers | Typical carriers |
| --- | --- | --- |
| Role and rules | How should the agent work and which boundaries apply? | System prompt, `AGENTS.md`, rules |
| External connections | How can it reach issues, builds, databases, and internal documents? | MCP and controlled tools |
| Task flow | Which steps complete this class of work? | Skills, scripts, templates |
| Distribution | How are the rules, flows, connections, and resources reused? | Plugins and toolkits |

Rules provide the floor, Skills provide repeatable methods, and hooks and scripts turn important constraints into executable checks. They are complementary: rules alone force rediscovery, a workflow can efficiently do the wrong thing, and scripts cannot resolve ambiguous product decisions.

## 2. Store facts, process, state, and experience together

### `AGENTS.md` is an index, not an encyclopedia

The root `AGENTS.md` should answer the practical cold-start questions: environment and tools, project map, required specifications, implementation and verification commands, stage gates, human approval points, and cleanup requirements.

It should contain high-frequency boundaries and navigation, not thousands of lines of detail. Split architecture, testing, security, and Git rules by topic and load them when needed. This reduces unrelated context and prevents competing copies of a rule.

### Separate process documents from durable facts

The discussion that produced this requirement and the contract that remains true after delivery have different lifetimes. A useful layout is:

```text
workflow/   current requirement and option history
specs/      durable API, data, module, and acceptance contracts
tasks/      executable units derived from the specifications
memory/     decisions and architecture records that outlive one task
```

Process documents preserve the trail; specifications constrain implementation. Once a task ends, discussion can be archived while the effective contract continues to evolve with the code. Record the source of important facts—user request, PRD, API, design, test, or log—so an unsupported assumption cannot silently become a requirement.

### Decisions need an expiration mechanism

Use `memory/decisions.md` for small decisions and `memory/adr/` for important architecture choices. When a new decision supersedes an old one, record the relationship and the reason. Otherwise a cold-start agent sees two apparently valid, conflicting rules and chooses unpredictably.

### State needs one machine source of truth

A state file such as `workflow-state.json` can represent a minimal lifecycle:

```text
discussion → option selected → ready → development → acceptance → submission
```

Complex work can extend this into a task graph with parallel branches, joins, rollbacks, and approvals. The shape can change, but the current state must remain in one auditable machine-readable source. Markdown explains why a transition happened; the state file tells scripts and hooks what is allowed now. Keep the user's actual approval wording when a human gate is crossed rather than reducing it to `confirmed: true`.

A minimal repository may look like this:

```text
my-project/
├── AGENTS.md                 # rules, map, commands, and gate index
├── workflow-state.json       # one machine-readable state source
├── workflow/                 # requirement and option history
├── specs/                    # durable contracts and acceptance criteria
├── tasks/                    # current executable work
├── memory/                   # decisions and ADRs
├── rules/                    # testing, security, Git, and other topics
├── .agents/                  # skills, hooks, and controlled connections
├── frontend/
├── backend/
├── tests/
└── scripts/
```

The exact tree is not the point. A new session should be able to answer where the project is, why the current approach was chosen, what to do next, and how to prove completion by reading the repository alone.

![The repository as project memory](/assets/blog/ai-native-development-system/02-repository-as-memory.webp)

## 3. Turn design and requirements into executable facts

Once the repository provides the working environment, make the requirement a target that an agent can compare and verify.

For an interface product, start with a runnable UI/UX prototype rather than production code. Deliver HTML for structure and interactions, CSS for visual rules, component code for decomposition, mock data for data shape, and the important permission, empty, disabled, and error states. Rules expressed only in a long document are easy to omit or interpret several ways. Put visible behavior in the prototype and keep prose for boundaries and exceptions.

The design is now a runnable reference: a person can operate it, and an agent can compare implementation against it. A long discovery transcript should also have a short brief that answers three questions: what problem the product solves, what this version includes, and what it explicitly excludes.

## 4. Make the first version small and runnable

After the prototype is accepted, give the agent one small runnable slice—perhaps one main screen and one core interaction—instead of ten pages at once. Fewer features mean fewer states, dependencies, and failure branches to understand simultaneously.

Each slice should:

1. run independently so a person can operate it;
2. add only one major uncertainty;
3. have an explicit acceptance boundary.

This appears slower than generating the complete product in one pass, but it compresses uncertainty per iteration. Failures are easier to locate and reverse, and the agent cannot stack a large amount of work on a wrong assumption.

![Runnable small slices](/assets/blog/ai-native-development-system/03-runnable-small-slices.webp)

## 5. Return a problem to the layer that caused it

Real operation usually reveals implementation problems and design problems. Fix crashes, state errors, performance regressions, and code-level deviations in the implementation. Send information hierarchy, interaction, and layout problems back to the prototype, then let the agent update the implementation against the changed design.

Patching design problems directly into production code makes the prototype and product diverge. The durable rule is simple: change design at the design layer, specifications at the specification layer, and implementation in code. `workflow/`, `specs/`, and source code then have distinct responsibilities instead of competing explanations.

![Return problems to their source layer](/assets/blog/ai-native-development-system/04-return-problem-to-source-layer.webp)

## 6. Use hard gates to control agent speed

> **The dangerous failure mode is usually not a slow agent but an agent that advances too quickly.** It can implement, test, refactor, and plan the next stage before a person has judged the previous direction.

“Wait for confirmation” in a prompt is not a reliable control. A transition should require three forms of evidence:

1. the documents for the current stage exist and meet its requirements;
2. the state file permits the next transition;
3. human judgment is preserved as the user's actual approval at a required gate.

Rules define what the agent must not cross; hooks and scripts make an invalid transition fail. Do not generate an implementation plan before the requirement is confirmed, split tasks before the option is selected, or submit before acceptance passes. The person reviews direction, boundaries, and release points; the agent explores and executes inside those boundaries.

![Human-gated development pipeline](/assets/blog/ai-native-development-system/05-human-gated-pipeline.webp)

## 7. Replace line-by-line review with feedback loops

When AI writes faster than a person reads, quality control should ask two questions: does the result satisfy the confirmed specification, and can a failure be exposed, located, and rolled back quickly?

```text
Spec → Task → observable acceptance → AI coding → run and check
                                      ↑                 │
                                      └── fix and retry ┘
```

Choose tests by risk and behavioral stability. Complex stable logic needs unit tests for boundaries and invariants; real dependencies need integration tests; shared front and back end schemas need contract tests; critical user paths need browser or E2E checks; weak assertions may require mutation testing, fault injection, or a real defect as a counterexample.

Static checks, type checks, and test output must be visible to the agent. A passing test file or compilation does not prove that a user path works. After testing, produce a reviewable report and remove test accounts, files, and database records so the environment can be restored. Use a lightweight browser check during ordinary iteration and reserve a full regression run for critical gates when resources are limited.

![Risk-based feedback loop](/assets/blog/ai-native-development-system/06-risk-based-feedback-loop.webp)

## 8. Review performance and structure after stability

Once a runnable version passes acceptance, an agent can review performance and structure before the next feature. Real data may reveal a memory or interaction problem that a static design cannot. For a bounded but historically complex module, add a new implementation beside the old one, compare results, then replace and remove the old path after validation. Parallel implementations are a migration technique, not a reason to keep two permanent paths.

Every file-changing task should state its boundary, preserve concurrent work, run proportionate verification, and leave an independent commit or equivalent rollback record. Do not rewrite history or push without authorization.

## 9. Test the system with six cold-start questions

The existence of directories does not prove that the system works. Start a new session and let the agent read only the repository. It should answer:

1. What is this project?
2. Which stage is the current requirement in?
3. What is allowed now?
4. Which process should be followed?
5. How is completion verified?
6. Where should this iteration's experience be recorded?

If it cannot answer, locate the missing project index, state, contract, verification entry point, or decision record instead of adding more abstract folders. In practice, verification is often the weakest link: state machines and rules can prevent uncontrolled progress, but only a runnable product, a real user path, observable feedback, and a recoverable environment prove that the product works.

![AI-native development system overview](/assets/blog/ai-native-development-system/infographic.webp)

## Closing

AI-native development does not mean asking an agent to write more code continuously. It assigns clear responsibilities:

- the repository stores facts, process, state, and experience;
- the agent explores, implements, verifies, and repairs quickly;
- people own requirements, design, boundaries, and stage approval;
- tests, hooks, state machines, and commits provide observable, auditable, reversible feedback.

> **Turn the repository into an agent workspace that can recover context. Turn goals into executable facts. Deliver runnable slices. Return problems to their source layer. Use gates and feedback loops to control progress.**

When both loops exist, generation can keep getting faster without becoming uncontrollable.
