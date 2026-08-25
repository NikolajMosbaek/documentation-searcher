# Documentation Searcher

[![CI](https://github.com/NikolajMosbaek/documentation-searcher/actions/workflows/ci.yml/badge.svg)](https://github.com/NikolajMosbaek/documentation-searcher/actions/workflows/ci.yml)

A Microsoft Teams bot, bound to a single codebase, that anyone in an organisation can ask about that codebase's behaviour in plain language — without a developer in the loop.

Questions about how software behaves come from product owners, testers and support staff, and they all route through a developer who usually has to go and find out too. This answers them directly, in product language, with no file names or code in the reply. Every answer it works out is written back into a knowledge base that lives beside the code, so the second person to ask the same thing gets it instantly and for nothing.

See [`PRD.md`](PRD.md) for why and what, [`CONSTITUTION.md`](CONSTITUTION.md) for the technical decisions that do not change, [`docs/diary/`](docs/diary/) for how it was built, in order, including what went wrong, and [`docs/review-backlog.md`](docs/review-backlog.md) for what is still open and what is waiting on a decision.

## How it answers

Every question goes to the knowledge base first.

1. **A question that leans on the conversation** — *"and how does it know?"* — is rewritten to stand on its own before anything else sees it.
2. **The knowledge base is searched.** The exact wording of a question that has been asked before always finds its entry, immediately and for nothing. Otherwise BM25 runs over the whole of every entry — and it *shortlists*, it does not decide. An entry is answered with on word-counting alone only when the evidence is overwhelming: a high score, most of the question accounted for, and at least twice the score of the runner-up. Everything else goes to a model, which is asked whether any candidate genuinely answers the question — cents and a few seconds, rather than the dollar and the minute a fresh answer costs. On a knowledge base of a handful of entries, word statistics say almost nothing, so nothing is written off on lexical evidence alone: the whole base goes for that second opinion instead.
3. **A stored entry is checked before it is trusted.** Each machine-written entry records the files it came from and a hash of them. Same hash, it is served. Different hash, the answer is worked out again and the entry refreshed first, so nobody is handed a silently outdated answer.
4. **A question nothing covers** sends the bot to read the codebase, write what it learns back as a new entry, and answer from that. If the code genuinely does not cover the question, it says so and does not guess.
5. **Saying an answer is wrong** in the thread makes the bot read the code again. The objection is a hint about where to look, never evidence — if the code supports the original answer, it says so rather than agreeing with you.

Costs, measured: about **$0.60–$1.15 and a minute** the first time a question is answered, then about **a millisecond and nothing** for everyone after. That ratio is the whole product. Every read of the codebase is logged with what it cost and which conversation caused it:

```
[SPEND] $0.7176 miss     thread=19:a1b2c3 (thread $0.7176, session $2.2489) What happens when a trial ends?
```

## Running it

```sh
npm install
DOCSEARCHER_CODEBASE=/path/to/the/codebase npm run dev
```

The bot listens on port 3978. Without `DOCSEARCHER_CODEBASE` it still runs and still answers from the knowledge base, but it cannot fill a gap — and says so once at startup.

To try it without a Teams tenant, install Microsoft's Agents Playground once and point it at the running bot:

```sh
npm install -g @microsoft/m365agentsplayground
DOCSEARCHER_ALLOW_UNAUTHENTICATED=true npm run dev   # in the terminal running the bot
npm run playground                                   # opens http://localhost:56150
```

Ask *"what happens when a user cancels a subscription mid-period?"* and you should get a structured answer from the seeded entries. Ask about anything else and, with a codebase configured, it will go and read it.

The Playground sends unauthenticated requests, which the bot rejects unless `DOCSEARCHER_ALLOW_UNAUTHENTICATED=true` is set — and it says so loudly in the log when it is. It is off unless asked for, rather than on unless forbidden, because the endpoint answers questions about a private codebase. No Teams tenant, tunnel, or Azure subscription is involved yet.

### Avoiding a cold start

On an existing codebase, have the bot propose what is worth documenting before anyone asks:

```sh
DOCSEARCHER_CODEBASE=/path/to/the/codebase npm run seed             # proposes seed-plan.md, writes nothing
$EDITOR seed-plan.md                                                # tick what is worth documenting
DOCSEARCHER_CODEBASE=/path/to/the/codebase npm run seed -- --dry-run # says what it would ask and what that costs
DOCSEARCHER_CODEBASE=/path/to/the/codebase npm run seed -- --write   # answers only what was ticked
```

Nothing arrives ticked and there is no flag that seeds everything: the point is to choose. `--dry-run` reports which ticked questions are already covered and what answering the rest would cost, without spending anything. `seed-plan.md` is a working file — commit it if a record of what was chosen is useful, or delete it.

### Checking it

```sh
npm test    # the suite. No network, no credentials, about a second
npm run typecheck
```

```sh
DOCSEARCHER_CODEBASE=/path/to/a/codebase npm run soak
```

The soak runs one realistic session end to end against the real engine — a cold question, the same question again, a rephrasing, a follow-up, a dispute with a false claim, a repeat dispute, a source file edited underneath it, and the refresh that follows. It costs two to three dollars and takes a few minutes, which is why it is not part of `npm test`. It copies the codebase first, so the original is never modified.

Its built-in questions are about *this* project, so pointed anywhere else it needs questions the codebase can actually answer:

```json
{
  "question": "What happens when a customer cancels partway through a month?",
  "rephrasing": "if someone stops paying mid-cycle, what do they keep?",
  "followUp": "and are they refunded?",
  "falseClaim": "that is wrong, they lose access straight away",
  "falseClaimMarker": "straight away"
}
```

```sh
DOCSEARCHER_CODEBASE=/path/to/a/codebase DOCSEARCHER_SOAK_SCENARIO=./soak.json npm run soak
```

An optional `alreadyCovered` is a question the starting entries answer, used only when the soak starts from a seeded knowledge base:

```sh
DOCSEARCHER_CODEBASE=/path/to/a/codebase DOCSEARCHER_SOAK_SEED=./knowledge-base npm run soak
```

The starting entries must not already answer the scenario's `question` — the run refuses if they do, because every count after that would be measuring a merge or a refresh instead of a fresh answer. Starting seeded is the more realistic case and the more revealing one. A base holding a few *unrelated* entries behaves differently from an empty one, and running against an empty one is what hid an over-matching bug until iteration 17.

`falseClaimMarker` is a phrase from `falseClaim` that must **not** appear once the bot has re-read the code. It is how the soak checks the most important thing it checks: that the bot does not agree with an objection the code does not support. A marker that does not appear in the claim is refused, because that check would then pass without testing anything.

## Configuration

| Variable | Default | What it does |
| --- | --- | --- |
| `DOCSEARCHER_CODEBASE` | unset | The one codebase this install answers about. Unset means gaps are never filled. |
| `DOCSEARCHER_KNOWLEDGE_BASE` | `./knowledge-base` | Where entries are read from and written to. |
| `DOCSEARCHER_MODEL` | `claude-opus-5` | The model behind the analysis engine. |
| `DOCSEARCHER_MAX_USD` | `5` | Ceiling for working out a single answer. Below about `1.5`, real questions get cut off. |
| `DOCSEARCHER_RESOLVER_MODEL` | falls back to `DOCSEARCHER_MODEL` | The model that rewrites follow-up questions. |
| `DOCSEARCHER_JUDGE_MODEL` | falls back to `DOCSEARCHER_MODEL` | The model that weighs near-miss candidates. |
| `DOCSEARCHER_SEED_AREAS` | `8` | How many areas seeding proposes. |
| `DOCSEARCHER_SEED_PLAN` | `./seed-plan.md` | Where the seeding checklist lives. |
| `DOCSEARCHER_SOAK_SCENARIO` | unset | A JSON file of questions for the soak. Unset uses the built-in ones, which are about this project. |
| `DOCSEARCHER_SOAK_SEED` | unset | A directory of entries to start the soak's knowledge base from. Unset starts it empty. |
| `PORT` | `3978` | The port the bot listens on. |
| `DOCSEARCHER_ALLOW_UNAUTHENTICATED` | unset | Set to `true` to accept unauthenticated requests, which the Playground sends. Local development only; it is off unless asked for. |

`disputeCooldownMs` is set in code rather than by environment, and defaults to five minutes — how long an entry is left alone after being re-read because someone disputed it.

Authentication is whatever the Claude Agent SDK already resolves from the environment. **No key is read, stored, or committed by this project.**

## Knowledge-base entries

One markdown file per entry, hand-editable and reviewable in a pull request:

```markdown
---
title: Cancelling a subscription mid-period
keywords: cancel, subscription, mid-period, refund
derived-from: src/billing/subscription.ts
fingerprint: 8e923ebab910d61b
---

## Questions
- what happens if I cancel halfway through a month?
- do I get a refund if I stop mid-cycle?

## Short answer
One or two sentences.

## What happens
1. Ordered steps

## Edge cases
- Conditions and exceptions
```

The questions, `derived-from` and `fingerprint` are written by the bot; a hand-written entry leaves all three out. All three are metadata and are never shown to an asker.

- **Questions** are every wording known to reach this entry, so asking one of them again is guaranteed to find it. Keywords cannot promise that — they are the model's words for the behaviour, and a question is the asker's words for the question. They live in a section rather than frontmatter because questions contain commas, which is how every frontmatter list here is separated. A single legacy `question:` field is still read.
- **`derived-from`** records which files the answer came from. It is the only place a file path may appear anywhere in the knowledge base.
- **`fingerprint`** is a content hash of those files when the entry was written. With `derived-from` it is what makes the staleness check work. An entry with no fingerprint is never treated as stale: a developer wrote it deliberately and owns it.

Entries must be in product language. Loading warns if one reads like code — file paths, function calls, backticks — because the PRD forbids code references in answers. For an answer the bot derived the same check is stricter: a leak means the answer is discarded rather than stored, since a stored entry is served to everyone who asks next.

A malformed entry is skipped with a warning rather than taking the whole knowledge base down, which matters now that the bot writes entries itself. Two entries that say the same thing about the same code are merged into one carrying both questions, so the knowledge base does not degrade as it fills.

"The same thing" is measured, not guessed: across every pair in the evaluation corpus, the two the engine genuinely produced twice for one question rank first and second, and the bar sits in the gap below them. "The same code" means the identical content hash — overlapping *file lists* was measured and is useless, because in a small codebase every answer reads most of the same files.

## Layout

The core knows nothing about Teams; the adapter decides nothing about answers. That split is a constitutional requirement, not a preference.

```
src/index.ts               the entire Teams adapter: resolves a thread id, calls the core, sends what it returns
src/seed.ts                the seeding command -- the one thing here a developer runs rather than asks
src/soak.ts                one realistic session against a real codebase
src/soakScenario.ts        what the soak asks, and the check that its questions are worth asking

src/core/index.ts          createCore(): ask(question, thread) -> Exchange. Knows nothing about Teams
src/core/answer.ts         the Answer shape, the markdown formatter, and the no-code-references guard
src/core/knowledgeBase.ts  reads, writes, parses and merges entry files; owns the lookup
src/core/retrieval.ts      BM25 over the entries; in-memory, rebuilt whenever one is written
src/core/sourceIndex.ts    content-hashes the files an answer came from, so staleness is detectable
src/core/threadContext.ts  in-memory conversation memory

src/core/engine.ts         the AnalysisEngine interface, the Derivation it returns, and the stub
src/core/followUp.ts       whether a question leans on the conversation, and the resolver interface
src/core/judge.ts          the second-opinion interface, for entries retrieval could not decide about
src/core/correction.ts     spots a disputed answer, and turns the objection into something to check
src/core/seeding.ts        the seeding plan: its shape, its format, and a forgiving parser

src/core/claudeEngine.ts   reads the codebase read-only and returns a structured answer
src/core/claudeResolver.ts rewrites a follow-up so it stands alone; reads the thread, never the codebase
src/core/claudeJudge.ts    weighs near-miss candidates; reads neither the codebase nor any file
src/core/claudeProposer.ts reads the codebase and proposes what is worth documenting first

src/core/fixtures/corpus/  twelve real entries this bot wrote, used to measure retrieval rather than assume it
src/core/*.test.ts         the suite -- run with `npm test`
src/docs.test.ts           checks this README against the code, because nothing else does
knowledge-base/            the entries themselves, as markdown
docs/diary/                how this was built, in order, including what went wrong
```

Every `claude*.ts` sits behind an interface in the file above it, so no call site knows which of them is the Claude Agent SDK.

## Known limits

- **Two entries derived either side of a code change never merge**, however alike they are, because the merge requires an identical content hash. Near-duplicates can therefore still accumulate over time. That is preferred to a looser rule, which measurement showed would merge behaviours that are merely neighbours.
- **It has never run inside Teams.** Only against the protocol. That needs a tenant.
- **Retrieval is only trusted to shortlist.** Measured against twelve real entries this bot wrote, deciding on word-counting alone served a wrong entry for three of ten rephrasings and answered two of seven entirely unrelated questions — and no absolute threshold fixed it, because a score grows with the corpus and with the rarity of the words involved. The bars are now high enough that most questions are shortlisted rather than answered outright, which costs a few seconds and a few cents on questions that used to be instant and free. That is the price of not serving confident wrong answers, and it is worth paying.
- **Retrieval is lexical.** A second opinion covers the band where it ranks something without being sure, but a question sharing *no* vocabulary with the entry that answers it never ranks at all, so there is nothing to weigh. Closing that means embeddings, which mean storage — deferred until a fake genuinely cannot cut it.
- **Follow-ups and near misses cost a few seconds.** Four to six, and four to five, which is most of what an asker waits for when the answer is already stored. Measured rather than guessed: a call doing the least possible work — no tools, one turn, one word out — still takes about 3.2 seconds and costs $0.0017, and a *smaller* model is slower. It is fixed overhead per call to the agent harness, not inference. A plain Messages API call would suit a text rewrite far better but needs its own credential, where the harness runs on whatever Claude Code is already authenticated with; that trade has been declined deliberately.
- **Reading a large codebase costs more.** Both cost measurements are against this project's own source, which is small and heavily commented. `DOCSEARCHER_MAX_USD` is the only bound.
- **Spend goes to stdout, and questions go with it.** Every read of the codebase logs its cost, its reason and the conversation that caused it, with a running total per thread and for the session — but it is a log line, not an audit trail, and it includes the question as asked. In a real deployment those questions are written by people, so treat the logs accordingly.

## Not built yet

Real Teams registration, and the two questions the PRD deliberately left open: whether the bot may propose changes to the code rather than only describing it, and whether access control is needed. Both are product decisions rather than missing work.
