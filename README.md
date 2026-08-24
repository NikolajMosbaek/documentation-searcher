# Documentation Searcher

Ask a codebase about its own behaviour from Microsoft Teams. See `PRD.md` for why and what, `CONSTITUTION.md` for the fixed technical decisions.

## Where this is right now

**Iteration 10: exercising the whole thing at once.** `npm test` covers each mechanism in isolation with fakes. `npm run soak` runs one realistic session against a copy of a real codebase with the real ones: a cold question, the same question again, a rephrasing, a follow-up, a dispute with a false claim, a repeat dispute, a source file edited underneath it, and the refresh that follows.

It found a bug the unit tests could not. The message shown when the same answer is flagged twice in a row was borrowing the "stale" provenance, so it rendered with a warning saying the code had changed and could not be checked — directly contradicting the message itself, which says the code was read moments ago. The unit test asserted the sentence and never rendered the answer. Provenance is now its own value, and every variant is rendered in a test.

The soak reads a real codebase several times, so it costs two to three dollars and takes a few minutes. That is why it is a separate command.

**Iteration 9: knowing what it costs.** The product turns on a question costing real money the first time and nothing afterwards, and until now that number was invisible. Every read of the codebase is reported with what it actually cost, why it happened, and a running session total:

```
[SPEND] $0.6070 miss     (session $0.6070) What does the bot do when nobody has configured a codebase for it?
```

Observed costs range from about $0.60 to about $1.15 per question, depending on how much of the codebase has to be read — so "roughly a dollar" is a range, not a figure.

Two things that were silently expensive are now bounded or visible. Flagging the same answer repeatedly no longer reads the whole codebase each time; an entry re-read within the last five minutes is left alone. And when the second opinion is offered candidates and rejects them all, that is logged — those are exactly the questions where money was spent on something the knowledge base may already have held, and they are the evidence for whether the judge is tuned correctly.

**Iteration 8: a second opinion on near misses.** Lexical retrieval is deliberately reluctant, which means it misses questions an entry really does answer — and a miss costs a derivation. When retrieval ranks something but is not confident, the candidates now go to a model that decides whether any of them actually answers the question. Cents and five seconds instead of a dollar and a minute.

It is gated at both ends: a confident hit is never second-guessed, and a question sharing no word with anything is never sent, because there is nothing to weigh. The judge is told to choose nothing when in doubt — a wrong rescue answers a question nobody asked, while a wrong refusal merely costs the derivation that would have happened anyway.

Measured on five questions: three near misses, two rescued and one conservatively declined; two unrelated questions cost nothing.

**Iteration 7: guided seeding.** `npm run seed` reads the codebase and proposes areas worth documenting first, as a checklist in `seed-plan.md`. Nothing is ticked and nothing is written. A developer ticks what they want, edits or deletes questions, and runs `npm run seed -- --write` — which answers only what was ticked, skipping anything the knowledge base already covers.

That two-step is the feature, not scaffolding around it: the PRD asks for "a reviewed baseline rather than an unattended bulk index", so there is deliberately no flag that seeds everything. Review of what gets written is the diff, because entries are files.

**Iteration 6: correcting an answer from the thread.** Saying *"that's wrong"* in the conversation makes the bot read the code again and rewrite the entry that produced the answer. The PRD's four maintenance paths are now all present: the bot fills gaps, the bot refreshes what went stale, developers edit the files, and anyone can flag a bad answer where they found it.

An objection is never treated as fact. It is handed to the engine as a pointer at what to re-read, with an instruction to contradict the objector if the code does — because the PRD makes the code the only source of truth, and someone in a chat thread is not the code. Measured against a deliberately false objection, the bot re-read and stood by its original answer.

**Iteration 5: follow-up questions.** A thread is now a conversation. A question that leans on what came before — *"and how does it know?"* — is rewritten into one that stands on its own before anything else sees it, so retrieval, derivation, and the entry that gets written all work on a question that means something by itself.

That last part is the reason this mattered more than it looked. Since the bot began writing entries, an unresolved follow-up was not merely answered badly; it was *stored*, under a title and keywords meaningless to anyone who was not in the thread.

Measured on a real three-question conversation: one derivation instead of three.

**Iteration 4: retrieval that retrieves.** Lookup is now BM25 over the whole of each entry — title, stored question, keywords, and answer text — rather than a substring count against curated keywords. A question phrased differently from the entry finds it, provided the two share vocabulary. There is still a guarantee underneath: the exact question that paid for an entry always finds it again.

A match must clear both a score and a coverage bar. Missing is the safe failure — it costs a re-derivation — while a wrong hit is served silently to everyone who asks next, so the bars are set to prefer missing.

`npm test` now runs the suite that makes any of this safe to change.

**Iteration 3: verify on read.** The PRD's mechanism is now complete. A question is answered from the knowledge base when an entry covers it *and* the code that entry describes has not moved. When the code has moved, the entry is derived again and refreshed before anyone is answered from it. When no entry covers the question at all, the bot reads the codebase, writes what it learns back, and answers from that.

Every machine-written entry records the files it came from and a content hash of those files. On each read the hash is recomputed: same hash, serve it; different hash, re-derive it. No CI hooks, commit hooks, or scheduled rebuilds, as the PRD requires — the check happens because someone asked.

The analysis engine is the Claude Agent SDK, behind the `AnalysisEngine` interface. It gets read-only access to the codebase and returns a structured answer, never prose to be parsed.

Measured on real questions: 40–55 seconds and roughly one US dollar to derive an answer, then about a millisecond and nothing for every asker after that. That ratio is the whole product.

## Running it

```sh
npm install
DOCSEARCHER_CODEBASE=/path/to/the/codebase npm run dev   # starts the agent on port 3978
npm test                                                 # the suite, no network or credentials needed
DOCSEARCHER_CODEBASE=/path/to/a/codebase npm run soak     # one real session end to end; costs a few dollars
```

The soak copies the codebase before touching it, so the original is never modified.

To avoid a cold start on an existing codebase:

```sh
DOCSEARCHER_CODEBASE=/path/to/the/codebase npm run seed            # proposes seed-plan.md, writes nothing
$EDITOR seed-plan.md                                               # tick what is worth documenting
DOCSEARCHER_CODEBASE=/path/to/the/codebase npm run seed -- --write # answers only what was ticked
```

`seed-plan.md` is a working file. Commit it if a record of what was chosen is useful, or delete it.

Without `DOCSEARCHER_CODEBASE` the bot still runs and still answers from the knowledge base, but it cannot fill a miss — it says so once at startup.

| Variable | Default | What it does |
| --- | --- | --- |
| `DOCSEARCHER_CODEBASE` | unset | The one codebase this install answers about. Unset means misses are never filled. |
| `DOCSEARCHER_KNOWLEDGE_BASE` | `./knowledge-base` | Where entries are read from and written to. |
| `DOCSEARCHER_MODEL` | `claude-opus-5` | The model behind the analysis engine. |
| `DOCSEARCHER_MAX_USD` | `5` | Ceiling for a single derivation. Below about `1.5` real questions get cut off. |
| `DOCSEARCHER_RESOLVER_MODEL` | falls back to `DOCSEARCHER_MODEL` | The model that rewrites follow-up questions. |
| `DOCSEARCHER_JUDGE_MODEL` | falls back to `DOCSEARCHER_MODEL` | The model that weighs near-miss candidates. |
| — | 5 minutes | How long an entry is left alone after a dispute re-read it. Set via `disputeCooldownMs` in code. |
| `DOCSEARCHER_SEED_AREAS` | `8` | How many areas seeding proposes. |
| `DOCSEARCHER_SEED_PLAN` | `./seed-plan.md` | Where the seeding checklist lives. |

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
src/core/retrieval.ts      BM25 over the entries; in-memory, rebuilt whenever one is written
src/core/followUp.ts       decides whether a question leans on the conversation, and the resolver interface
src/core/correction.ts     spots someone disputing an answer, and turns the objection into something to check
src/core/judge.ts          the second-opinion interface, for entries retrieval could not decide about
src/core/claudeJudge.ts    weighs near-miss candidates against the question; reads neither codebase nor files
src/core/seeding.ts        the seeding plan: its shape, its format, and a forgiving parser for a hand-edited one
src/core/claudeProposer.ts reads the codebase and proposes what is worth documenting first
src/seed.ts                the seeding command -- the one thing here a developer runs rather than asks
src/core/claudeResolver.ts rewrites a follow-up so it stands alone; reads the thread, never the codebase
src/core/*.test.ts         the suite -- run with `npm test`
src/soak.ts                one realistic session against a real codebase -- run with `npm run soak`
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

Real Teams registration. Nothing in this project has yet run inside an actual Teams client — only against the protocol.

Nothing rate-limits a dispute. Flagging an answer costs a full derivation, so anyone who can reach the bot can spend money by repeatedly disagreeing with it.

Resolving a follow-up costs four to six seconds, and weighing a near miss four to five, which is most of what an asker waits for when the answer is already stored. This was measured rather than guessed: a call doing the least possible work — no tools, one turn, one word of output — still takes about 3.2 seconds and costs $0.0017. The latency is fixed overhead per call to the agent harness, not inference, and a smaller model is *slower* rather than faster.

The obvious fix is not free. A plain Messages API call would suit a text rewrite far better, but it needs its own credential, where the agent harness runs on whatever Claude Code is already authenticated with. That trades a few seconds of latency for an API key to provision and protect, so it has been left alone deliberately.

Retrieval is lexical, and a second opinion now covers the band where it ranks something without being sure. What is still uncovered is a question sharing *no* vocabulary at all with the entry that answers it: nothing ranks, so there is nothing to weigh, and no amount of judging reaches it. Closing that means embeddings, which mean storage — deferred until a fake genuinely cannot cut it.
