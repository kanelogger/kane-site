---
locale: "en"
translationKey: "agent-token-economics"
slug: "agent-token-economics"
translationStatus: "summary"
categoryId: "ai-engineering"
tagIds: ['coding-agent', 'token-cost', 'multi-agent', 'model-routing']
title: "Parallel Work Does Not Save Tokens"
description: "Break down the full agent cost chain, separate time gains from token billing, and choose tools and multi-agent collaboration by measurable cost."
publishedAt: "2026-08-30"
category: "AI Engineering"
tags: ['coding-agent', 'token-cost', 'multi-agent', 'model-routing']
featured: false
order: 2
author: "Kane"
---

## Cost is a chain

The user prompt is usually the cheapest part of a request. The bill is dominated by system instructions, project documents, skills, repeated context, tool output, failed attempts, and agents reading the same background again.

A useful model is:

```text
lower total cost = less repeated context + better model routing
                  + precise retrieval + clear agent boundaries
                  + fewer retries
```

## Six cost sources

Fixed context includes the system prompt, `AGENTS.md`, resident skills, and tool definitions. Conversation history grows when unrelated work shares a session. Work material includes files, web pages, logs, MCP responses, and browser snapshots. Model calls become expensive when every task uses the strongest model. Failure and retries multiply all previous costs. Collaboration adds duplicate reads and handoff overhead.

## Choosing an optimization

Compress stable instructions and load specialist skills only when needed. Route planning and review to stronger models, and implementation to models that meet the task's risk level. Retrieve only the files required by the current question. Use isolated subagents when their work is genuinely independent; otherwise, parallel agents may increase total tokens even while reducing elapsed time.

Measure total input, output, tool calls, retries, and wall-clock time together. Optimize the largest observed term rather than saving a few prompt words.

This is an English summary; read the [Chinese original](/writing/agent-token-economics) for the full examples and analysis.
