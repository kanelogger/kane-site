---
locale: "en"
translationKey: "agent-project-recovery"
slug: "agent-project-recovery"
translationStatus: "reviewed"
categoryId: "ai-engineering"
tagIds: ["coding-agent", "agents-md", "agent-harness", "context-engineering"]

title: "How an Agent Recovers a Project Without Chat History"
description: "Turn a repository into an agent workspace so a fresh session can recover project facts, state, and the correct workflow from files alone."
publishedAt: "2026-08-30"
category: "AI Engineering"
tags: ["Coding Agent", "AGENTS.md", "Agent Harness", "Context engineering"]
featured: true
order: 0
author: "Kane"
featuredOrder: 1
---

This article asks what a standard vibe-coding project must contain so that a new session with no chat history can understand the project, recover its state, and follow the right process. Treat the LLM as an approximately stateless function: every call should be able to reconstruct the task from the repository.

**An agent-oriented repository stores more than source code. It stores the effective facts, process entry points, machine state, and long-term experience required to work safely.**

## The capability layers

| Layer | Question | Typical carrier |
| --- | --- | --- |
| Role | How should the agent work, and which boundaries apply? | `AGENTS.md`, rules |
| Rules | Which stable constraints must always hold? | Rules |
| Skills | Which repeatable, on-demand methods should be available? | `SKILL.md` files |
| Task flow | Which steps complete this class of task? | Hooks, scripts, templates |
| External connections | How can the agent access issues, builds, databases, and documents? | MCP and controlled tools |
| Distribution | How are rules, flows, and resources reused? | Plugins and toolkits |

## A project skeleton

```text
project/
├── .agents/               # skills, workflow hooks, and controlled connections
│   ├── skills/
│   ├── hooks/
│   └── mcp.json
├── docs/adr/              # decisions that outlive one requirement
├── rules/                 # stable boundaries and constraints
├── specs/                 # current contracts and project facts
├── tasks/                 # task decomposition and active work
├── workflow/              # the current requirement's discussion and options
├── workflow-state.json    # current stage and allowed actions
└── AGENTS.md              # role and entry instructions
```

This is a complete vocabulary, not a mandatory tree. Remove directories that do not carry real information. Distribution is supplied by plugins and toolkits rather than by another directory in the project.

## `AGENTS.md` is the entry point

`AGENTS.md` contains the stable rules an agent should read whenever it enters a scope. Keep three levels separate:

- **User level:** cross-project collaboration preferences and safety boundaries.
- **Project level:** repository facts, verification entry points, and constraints needed for almost every task.
- **Directory level:** responsibilities and rules unique to one package or directory.

Keep each rule in one source of truth. Put detailed knowledge in `docs/`, fixed procedures in Skills, and facts that can be read reliably from code, configuration, or schemas in those sources rather than duplicating them in `AGENTS.md`. The root file is an index: adding a paragraph should be justified by the attention it consumes in every session.

### User-level template

The user-level file stores only long-lived preferences that apply across projects. It should cover goals, decision principles, communication style, working style, verification expectations, tool preferences, safety boundaries, and file-maintenance rules. Do not rewrite it automatically after one conversation.

```markdown
# Collaboration agreement

## Goals
## Decision principles
## Communication
## Working style
## Verification
## Tool preferences
## Safety boundaries
## File maintenance
```

Only add a rule when it applies across projects, is expected to remain stable, reflects the user's judgment, and cannot be derived from the current repository.

### Project-level template

The project file is the smallest repository entry point:

```markdown
# Project

## Tools and verification
- Package manager
- Build and test commands

## Repository constraints
- Rules that apply across the repository

## Stable domain concepts
- Terms that are easy to confuse

## On-demand guides
- Links to language, testing, and workflow documents

## Local rules
- Directory-specific entry points
```

Keep the root file short, executable, and stable. Do not add a one-off correction, a fact already present in configuration, or a vague aspiration.

### Directory-level template

Create a local `AGENTS.md` only when a directory is an independent and stable work scope. It should state that scope, its unique technology, local constraints, and links to on-demand guides. It supplements the project file and should not repeat it.

## Improve existing documents deliberately

When an `AGENTS.md` has grown too large, use a staged review:

1. Identify conflicting instructions and resolve the conflict explicitly.
2. Keep only the project description, non-standard commands, and rules that matter to nearly every task in the root file.
3. Move the rest into topic documents such as testing, security, TypeScript, API design, or Git workflow.
4. Replace the root file with an index linking to those documents.
5. Remove redundant, vague, obvious, and unexecutable instructions.

## Manage Skills as a distribution layer

Low-frequency procedures should be enabled on demand so they do not permanently consume context. Frequently used procedures can be installed globally. A local Skill Hub can install or link each Skill once, then explicitly enable it per project or globally. The important properties are explicit ownership, a traceable source, and a removable enablement.

## The cold-start test

Start a new session and give the agent only the repository. It should be able to answer: what is this project, what is the current task and state, what may I do now, which workflow applies, how will I verify completion, and where should new experience be recorded? If it cannot answer, add the missing fact or entry point at the layer that owns it rather than adding more generic instructions.

This turns context recovery into a property of the project. The agent can change, the conversation can end, and the work can still resume from the same facts.
