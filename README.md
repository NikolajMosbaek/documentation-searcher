# Documentation Searcher

Ask a codebase about its own behaviour from Microsoft Teams. See `PRD.md` for why and what, `CONSTITUTION.md` for the fixed technical decisions.

## Where this is right now

**Iteration 1: the conversation, faked.** The Teams adapter, the transport-agnostic core, the answer format, and the file-based knowledge base are real. The codebase analysis is not — `unavailableEngine` always misses, so anything the knowledge base doesn't cover gets an honest "I don't know" rather than an invented answer.

What that means in practice: three hand-written entries about subscription billing answer questions well, and everything else misses. That is the point of this iteration — get the shape and the flow right before spending anything on the hard part.

## Running it

```sh
npm install
npm run dev          # starts the agent on port 3978
```

In a second terminal, install the Microsoft 365 Agents Playground once and point it at the running agent:

```sh
npm install -g @microsoft/m365agentsplayground
npm run playground   # opens http://localhost:56150
```

Ask it *"what happens when a user cancels a subscription mid-period?"* and you should get a structured answer. Ask it about anything else and you should get a clean miss.

The Playground sends unauthenticated requests, so the app enables `dangerouslyAllowUnauthenticatedRequests` whenever `NODE_ENV` is not `production`. No Teams tenant, tunnel, or Azure subscription is involved yet.

## Layout

```
src/index.ts          the entire Teams adapter -- resolves a thread id, calls the core, sends what it returns
src/core/index.ts     createCore(): ask(question, thread) -> Answer. Knows nothing about Teams
src/core/answer.ts    the Answer shape, the markdown formatter, and the no-code-references guard
src/core/knowledgeBase.ts  loads and parses entry files; keyword lookup (a placeholder, not retrieval)
src/core/engine.ts    the AnalysisEngine interface and the stub standing in for it
src/core/threadContext.ts  in-memory conversation memory
knowledge-base/       the entries themselves, as markdown
```

## Knowledge-base entries

One markdown file per entry, hand-editable and reviewable in a pull request:

```markdown
---
title: Cancelling a subscription mid-period
keywords: cancel, subscription, mid-period, refund
---

## Short answer
One or two sentences.

## What happens
1. Ordered steps

## Edge cases
- Conditions and exceptions
```

Entries must be in product language. `loadKnowledgeBase` warns on load if an entry reads like code — file paths, function calls, line numbers, backticks — because the PRD forbids code references in answers.

## Deliberately not built yet

Verify-on-read staleness checking, guided seeding, in-thread correction, the Claude Agent SDK, and real Teams registration.
