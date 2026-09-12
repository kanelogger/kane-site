---
locale: "en"
translationKey: "agent-hard-gates"
slug: "agent-hard-gates"
translationStatus: "reviewed"
categoryId: "ai-engineering"
tagIds: ["coding-agent", "gates", "testing"]

title: "Hard Gates for Fast Agents"
description: "Use observable acceptance criteria, risk-based tests, hard gates, and independent review to keep a fast Coding Agent on the intended path."
publishedAt: "2026-08-30"
category: "AI Engineering"
tags: ["Coding Agent", "Stage gates", "Acceptance", "Testing strategy"]
featured: true
order: 1
author: "Kane"
featuredOrder: 2
---

> How should an agent move forward safely?

Once an agent can run a high-quality task, the next problem is controlling how it runs. Coding agents are designed to keep moving and to finish everything in one pass. When implementation becomes faster than human reading, the eventual interface may be a single `/goal` command. That makes the workflow, evidence, and gates more important than a prompt that merely asks the agent to wait.

My conclusion is to divide responsibility: people and strong reasoning models focus on design and review; an implementation model can be cheaper; every important transition still needs a hard constraint and a test that can accurately check the requirement.

## Why speed changes quality control

- A person cannot keep line-by-line comprehension as the primary control method.
- The most dangerous state is an agent that advances continuously without confirming direction.
- Quality control must ask three questions:
  1. Is the goal explicit and observable?
  2. Does the implementation satisfy the effective specification?
  3. Can a failure be exposed, located, and rolled back quickly?

Turn requirements into executable facts, split the feature into runnable slices, return problems to the layer that caused them, and control the pace with automated feedback, human gates, and independent review.

```text
Opportunity check
  → requirement confirmation
  → design confirmation
  → implementation ready
  → development and feedback loop
  → acceptance and independent review
  → cleanup and commit
```

## Decide whether to build it

Start with feasibility and product-value analysis. A feature consumes more than tokens: it changes the product's overall design, and removing it later may be expensive. The agent should inspect the current system, list viable technical paths, expose uncertainty, and produce three options with a recommendation. The person decides product value and records why the other options were not selected so the same discussion does not repeat.

## Write the design document

An AI-assisted design document combines product and technical design. It answers:

1. What problem does this product change solve?
2. What does this version include?
3. What is deliberately out of scope?

Every requirement needs observable acceptance conditions. Describe behavior a user can see, cover success, failure, empty, permission, and boundary states, separate product requirements from technical constraints and implementation suggestions, and map each delivery to a command or an actual operation path.

## Make the prototype executable

For an interface, provide a design system, UI prototype, component references, or Storybook as material for the agent. Use mock data to express permissions, empty states, disabled controls, and error feedback wherever possible.

For an API, CLI, library, or data task, provide data structures, request and response examples, schemas, and contracts. Once behavior is stable, a separate iteration can ask the agent to optimize performance against the working version.

## Close the feedback loop during implementation

Give the agent the accepted specification and prototype. It should implement one milestone, run the proportionate checks, inspect the real page when UI is involved, and repair the root cause when a check fails.

```text
Spec → Task → observable acceptance → AI coding → Run and check
                                      ↑                 │
                                      └── fix and retry ┘
```

The rules are:

- complete a runnable slice at each milestone;
- run checks proportional to the change;
- fix the root cause instead of weakening assertions or hiding errors;
- have the agent open the real page and capture or inspect the state for UI work.

Return each problem to its source layer: requirement problems change the requirement, design problems change the design, specification problems change the specification, implementation problems change code, and testing problems change the verification method. Do not patch an upstream mistake indefinitely in the code layer.

## Choose tests by risk

| Risk | Primary verification |
| --- | --- |
| Complex, stable core logic | Unit tests for boundaries, state transitions, and invariants |
| Modules working with real dependencies | Integration tests |
| Field consistency across services | Contract tests |
| Critical user paths | E2E or browser automation |
| Interface and experience | Real operation, screenshots, and observable state |

Unit, integration, and E2E tests are complementary. Core business logic deserves strong unit coverage; cross-module CRUD and page-heavy systems need more integration, contract, and E2E checks. Static checks, type checks, and test output must be visible to the agent. A compile result or a test file is not evidence that the key user path works.

After tests, produce a reviewable report and remove test accounts, files, database rows, and background processes. On a constrained machine, use a light browser check during normal iteration and reserve a complete browser regression for a critical gate.

## Run an independent review

Use a different model or agent as reviewer when the consequence of a wrong assumption is high. Provide the original requirement and effective specification, final diff, test and smoke-test results, logs, screenshots or performance data, and known risks and non-goals. Do not pass the entire handoff conversation; independent context helps the reviewer avoid inheriting the same assumption.

The reviewer should look for conditions that make the implementation fail, incomplete boundaries, tests that miss real defects, and the difference between a defect, a preference, and an unsupported guess.

## Perform a black-box acceptance pass

The product owner remains responsible for the final user journey. Operate the product as an ordinary user, verify the experience and logic loop, and return each discovered problem to the correct source layer for repair and re-checking.

## Clean up before committing

Development and testing leave temporary accounts, files, databases, and processes behind. Clean them before committing. Keep the diff limited to the task, preserve a rollback point, and do not push or rewrite history without authorization.

## Gates control the pace

An agent can implement, test, refactor, and plan the next stage in minutes while a person is still deciding whether the previous direction is correct. “Please wait for confirmation” in a prompt is not enough. A stage transition should require:

1. the stage documents exist and satisfy their requirements;
2. the state file permits the transition;
3. a required human decision preserves the user's actual approval.

Hooks can make an invalid transition fail: do not generate an implementation plan before the requirement is confirmed, split tasks before an option is selected, or submit and publish before acceptance passes.

**The person owns direction, boundaries, and release. The agent owns fast exploration and execution inside the current gate.**
