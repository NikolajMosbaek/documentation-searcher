# Documentation Searcher

Ask a codebase about its own behaviour from Microsoft Teams. See `PRD.md` for why and what, `CONSTITUTION.md` for the fixed technical decisions.

## Where this is right now

**Iteration 2: the core loop, for real.** A question is answered from the knowledge base when an entry covers it. When none does, the bot reads the codebase, writes what it learns back as a new entry, and answers from that — so the second person to ask the same thing gets it instantly. Only when the codebase genuinely does not cover the question does the bot say so.

The analysis engine is the Claude Agent SDK, behind the `AnalysisEngine` interface. It gets read-only access to the codebase and returns a structured answer, never prose to be parsed.

Measured on a real question: about 40 seconds and roughly one US dollar to derive an answer, then 0 ms and nothing for every asker after that. That ratio is the whole product.

## Running it

```sh
npm install
DOCSEARCHER_CODEBASE=/path/to/the/codebase npm run dev   # starts the agent on port 3978
```

Without `DOCSEARCHER_CODEBASE` the bot still runs and still answers from the knowledge base, but it cannot fill a miss — it says so once at startup.

| Variable | Default | What it does |
| --- | --- | --- |
| `DOCSEARCHER_CODEBASE` | unset | The one codebase this install answers about. Unset means misses are never filled. |
| `DOCSEARCHER_KNOWLEDGE_BASE` | `./knowledge-base` | Where entries are read from and written to. |
| `DOCSEARCHER_MODEL` | `claude-opus-5` | The model behind the analysis engine. |
| `DOCSEARCHER_MAX_USD` | `5` | Ceiling for a single derivation. Below about `1.5` real questions get cut off. |

Authentication is whatever the Claude Agent SDK already resolves from the environment. No key is read, stored, or committed by this project.

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
src/core/knowledgeBase.ts  reads, writes and parses entry files; keyword lookup (a placeholder, not retrieval)
src/core/engine.ts    the AnalysisEngine interface, the Derivation it returns, and the stub
src/core/claudeEngine.ts   the real engine: reads the codebase read-only, returns a structured answer
src/core/threadContext.ts  in-memory conversation memory
knowledge-base/       the entries themselves, as markdown
```

## Knowledge-base entries

One markdown file per entry, hand-editable and reviewable in a pull request:

```markdown
---
title: Cancelling a subscription mid-period
keywords: cancel, subscription, mid-period, refund
derived-from: src/billing/subscription.ts
---

## Short answer
One or two sentences.

## What happens
1. Ordered steps

## Edge cases
- Conditions and exceptions
```

`derived-from` is written by the bot and records which files an answer came from. It is metadata for a future staleness check, never shown to an asker, and it is the only place a file path may appear. Hand-written entries can leave it out.

Entries must be in product language. `loadKnowledgeBase` warns on load if an entry reads like code — file paths, function calls, backticks — because the PRD forbids code references in answers. For an answer the bot derived, the same check is stricter: a leak means the answer is discarded rather than stored, because a stored entry gets served to everyone who asks next.

A malformed entry is skipped with a warning rather than taking down the whole knowledge base, which matters now that the bot writes entries itself.

## Deliberately not built yet

Verify-on-read staleness checking (the `derived-from` metadata it needs is already being recorded, but nothing reads it), guided seeding, in-thread correction, real retrieval in place of keyword matching, follow-up questions actually using thread context, and real Teams registration.
