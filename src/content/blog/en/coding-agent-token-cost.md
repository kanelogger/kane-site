---
locale: "en"
translationKey: "coding-agent-token-cost"
slug: "coding-agent-token-cost"
translationStatus: "summary"
categoryId: "ai-programming"
tagIds: ['coding-agent', 'token-cost', 'context-engineering', 'model-routing']
title: "Where Coding Agent Tokens Go"
description: "A practical accounting of system prompts, repository context, tools, retries, and model routing shows where coding-agent costs really accumulate."
publishedAt: "2026-08-07"
category: "AI Programming"
tags: ['coding-agent', 'token-cost', 'context-engineering', 'model-routing']
featured: false
order: 4
author: "Kane"
---

## The visible prompt is a small line item

When a coding agent receives a short request, the system may also attach project rules, skills, tool definitions, files, logs, and prior turns. Those hidden inputs determine most of the token bill.

Separate a request into fixed context, session history, work material, model output, tool output, and retry cost. This accounting makes optimization concrete: remove duplicated context, shorten noisy tool output, and keep one goal per session.

## Context and routing

Keep `AGENTS.md` focused on durable constraints. Put repeatable procedures in skills that load on demand. Use precise repository search instead of sending whole directories. Assign each task to the least expensive model that can meet its risk and reasoning requirements, then upgrade only when evidence shows a need.

## Measure the whole loop

A cheaper individual call can be more expensive overall if it causes retries or weak verification. Track successful result cost, failed attempts, tool calls, and review time together. The right target is the cost of an accepted result, not the price of one completion.

This is an English summary; read the [Chinese original](/writing/coding-agent-token-cost) for the full accounting and optimization methods.
