# Documentation Searcher

Ask a codebase about its own behaviour from Microsoft Teams. See `PRD.md` for why and what, `CONSTITUTION.md` for the fixed technical decisions.

## Where this is right now

**Iteration 3: verify on read.** The PRD's mechanism is now complete. A question is answered from the knowledge base when an entry covers it *and* the code that entry describes has not moved. When the code has moved, the entry is derived again and refreshed before anyone is answered from it. When no entry covers the question at all, the bot reads the codebase, writes what it learns back, and answers from that.

Every machine-written entry records the files it came from and a content hash of those files. On each read the hash is recomputed: same hash, serve it; different hash, re-derive it. No CI hooks, commit hooks, or scheduled rebuilds, as the PRD requires — the check happens because someone asked.

The analysis engine is the Claude Agent SDK, behind the `AnalysisEngine` interface. It gets read-only access to the codebase and returns a structured answer, never prose to be parsed.

Measured on real questions: 40–55 seconds and roughly one US dollar to derive an answer, then about a millisecond and nothing for every asker after that. That ratio is the whole product.

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
src/core/sourceIndex.ts    content-hashes the files an answer came from, so staleness is detectable
src/core/threadContext.ts  in-memory conversation memory
knowledge-base/       the entries themselves, as markdown
```

## Knowledge-base entries

One markdown file per entry, hand-editable and reviewable in a pull request:

```markdown
---
title: Cancelling a subscription mid-period
question: what happens if I cancel halfway through a month?
keywords: cancel, subscription, mid-period, refund
derived-from: src/billing/subscription.ts
fingerprint: 8e923ebab910d61b
---

## Short answer
One or two sentences.

## What happens
1. Ordered steps

## Edge cases
- Conditions and exceptions
```

`question`, `derived-from`, and `fingerprint` are written by the bot. `derived-from` records which files the answer came from and `fingerprint` is a content hash of those files at the moment it was written; together they are what makes verify-on-read work. `question` is the exact question that paid for the entry, stored so that asking it again is guaranteed to find it — keyword matching cannot promise that, because the keywords are the model's words for the behaviour and the question is the asker's words for the question.

All three are metadata and never shown to an asker. `derived-from` is the only place a file path may appear anywhere in the knowledge base. Hand-written entries leave all three out, and an entry with no fingerprint is never treated as stale — a developer wrote it deliberately and owns it.

Entries must be in product language. `loadKnowledgeBase` warns on load if an entry reads like code — file paths, function calls, backticks — because the PRD forbids code references in answers. For an answer the bot derived, the same check is stricter: a leak means the answer is discarded rather than stored, because a stored entry gets served to everyone who asks next.

A malformed entry is skipped with a warning rather than taking down the whole knowledge base, which matters now that the bot writes entries itself.

## Deliberately not built yet

Guided seeding, in-thread correction, follow-up questions actually using thread context, and real Teams registration.

Real retrieval is the conspicuous gap. Asking the *same* question twice is guaranteed to hit, but asking the same thing in different words still misses and pays for a fresh derivation of an answer the knowledge base already holds — at roughly a dollar a time, that is now the most expensive weakness left.
