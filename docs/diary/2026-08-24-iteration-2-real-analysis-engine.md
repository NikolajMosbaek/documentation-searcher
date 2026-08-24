# Diary: Iteration 2 — the real analysis engine

Iteration 1 left the product's central mechanism faked: the knowledge base answered, and everything it did not cover returned an honest miss because `unavailableEngine` always returned null. The PRD's core loop is "consult the documentation layer first; on a miss, search the codebase, write what you learn back, then answer" — only the first half existed. This iteration built the second half.

By the end, a question the knowledge base does not cover is answered by reading the codebase with the Claude Agent SDK, stored as a new entry, and served from the store on every subsequent asking.

## Step 1: Choosing the iteration and establishing the SDK's real surface

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`, followed mid-turn by "Make sure to commit and push after each iteration" and "NEVER!!! commit any sensitive information or secrets. Remember this is a public repo"

**Interpretation:** Run `/suggest-next-iteration` against the target project, and rather than presenting options and waiting, take the recommended one and build it. Commit and push each completed iteration. Treat the repository as public throughout.

**Inferred intent:** Keep the greenfield loop moving unattended overnight, with each iteration landing as a reviewable commit rather than accumulating as uncommitted work.

### What I did

Established first that the loop runs against this project and not against the skills library the session's working directory pointed at. That library directory is a sibling of this one; it is not a git repository at all, has no `PRD.md`, and symlinks `.claude/skills -> ../skills` — it is where the skills live, not where they run.

Followed `suggest-next-iteration`: read `/PRD.md` and `/CONSTITUTION.md`, read iteration 1's diary and the whole of `/src`, then proposed three candidates — the real engine with lazy population, verify-on-read staleness, or real retrieval with working follow-ups — and took the first. Staleness has nothing to re-derive with until the engine exists, and better retrieval only improves lookup for entries that nothing can yet create.

Then, because the constitution pins `@anthropic-ai/claude-agent-sdk` and this iteration is entirely Anthropic SDK code, loaded the `claude-api` skill before writing anything.

### Why

The PRD's mechanism is the product. Everything else in the backlog either depends on the engine or polishes a loop whose second half is missing. Iteration 1 deliberately faked it to get the shape right cheaply; the shape held, so the next honest move was to attack the risk it deferred.

### What worked

The `claude-api` skill answered by telling me it was the wrong skill, which was exactly the right outcome. It states plainly that it covers the Claude API and Managed Agents and **does not** generate Claude Agent SDK code, and that the Agent SDK is a separate package with its own documentation. Loading it cost one call and prevented writing Messages-API-shaped code against an SDK that does not work that way.

Reading the installed package's own type definitions was decisive. `npm install @anthropic-ai/claude-agent-sdk` resolved `0.3.241`, and `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` is the authoritative surface. Four things came out of it that changed the design:

- The final message is `{ type: 'result', subtype: 'success', result: string, structured_output?: unknown, ... }`.
- There is an `outputFormat: { type: 'json_schema', schema }` option, so the engine can return a validated object instead of prose someone has to parse.
- `allowedTools` **only auto-approves**; its own doc comment says "To restrict which tools are available, use the `tools` option instead."
- `settingSources` defaults to loading every filesystem settings source: "When omitted, all sources are loaded (matches CLI defaults). Pass `[]` to disable filesystem settings (SDK isolation mode). Must include `'project'` to load CLAUDE.md files."

That last one is the one I would not have thought to look for. Omitting `settingSources` means the codebase being analysed gets to load its own `CLAUDE.md` and `.claude/settings.json` into the session that is reading it — any checkout this bot is pointed at could rewrite the product-language rules it is being read under. Passing `[]` closes that.

### What didn't work

**The documentation was wrong where the package was right.** `WebFetch` against `https://code.claude.com/docs/en/agent-sdk/typescript` returned a confidently-shaped API that does not exist: a `SDKFinalResultMessage` typed as `type: 'assistant'` with the final text at `message.text`, an `SDKTextMessage` with `message.type: 'text'`, and a usage example pinning `claude-3-5-sonnet-20241022`. The real result message is `type: 'result'` with the text at `.result`. Code written from that summary would have silently never matched a message and always returned a miss — a failure that looks exactly like "the engine found nothing."

This is iteration 1's lesson recurring for the third time: treat the docs as directionally right and the installed package as authoritative. Iteration 1 hit it twice with Microsoft Learn (deprecated DevTools, deprecated `skipAuth`); this time the fetched summary appeared to be partly synthesized rather than merely stale, which is harder to spot because nothing about it reads as out of date.

### What I learned

The `AnalysisEngine` seam from iteration 1 was very slightly wrong, and only building against it revealed how. It returned `Answer | null`, but an engine that answers on a miss must also produce the material to *store* the answer — a title and lookup keywords — and it is the only component that knows which files it read. Returning just an `Answer` would have forced the core to invent a title or the knowledge base to re-derive one. Widening it to a `Derivation` was a two-line change because the seam existed at all, which is the argument for having drawn it in iteration 1.

### What was tricky

Deciding whether to record `derivedFrom` now. Nothing this iteration reads it, which normally argues for leaving it out. But it is the one thing that cannot be backfilled cheaply — reconstructing which files an answer came from means paying for the whole derivation again — and verify-on-read is blocked without it. It also sits awkwardly against the PRD's ban on code references, so it is documented in three places as metadata that is never shown to an asker, and it is deliberately the only field where a path may appear.

### What warrants review

The judgement call above: `Derivation.derivedFrom` is written into every entry's frontmatter and read by nothing. If verify-on-read gets dropped or redesigned, it is dead weight and should go.

### Future work

Nothing pins the Agent SDK version in `/CONSTITUTION.md`, the same gap iteration 1 recorded for the Teams SDK. `@anthropic-ai/claude-agent-sdk` resolved to `0.3.241` — a `0.x` line, so the `Options` surface this iteration reads is not covered by any stability promise.

## Step 2: Building the engine and the write-back

**Author:** main

### Prompt Context

**Verbatim prompt:** (continuation of the same `/loop` instruction — no new user prompt initiated this step)
**Interpretation:** Build the chosen iteration.
**Inferred intent:** A working core loop, not a demo of the SDK.

### What I did

Added `/src/core/claudeEngine.ts`, the real `AnalysisEngine`. Widened `/src/core/engine.ts` from `Answer | null` to a `Derivation` carrying the answer plus `title`, `keywords`, and `derivedFrom`. Rewrote `/src/core/knowledgeBase.ts` to write entries as well as read them, and to survive a malformed one. Rewired `/src/core/index.ts` so `ask` populates on a miss, and `/src/index.ts` to build the engine from configuration. Updated `/README.md`.

The read-only sandbox takes three options working together, and the comment in the code says so because no one of them is sufficient:

```ts
tools: READ_ONLY_TOOLS,        // decides what exists at all
allowedTools: READ_ONLY_TOOLS, // stops the session pausing to ask about them
permissionMode: 'dontAsk',     // denies anything else instead of prompting nobody
settingSources: [],            // the analysed codebase cannot instruct its reader
persistSession: false,
```

Structured output carries the product-language rules into the schema rather than trusting prose: an `answered` boolean so the model can decline instead of confabulating to fill required fields, and separate `shortAnswer` / `behaviour` / `edgeCases` / `title` / `keywords` / `derivedFrom` fields. `structured_output` is typed `unknown`, so `toDerivation` validates every field at runtime and returns null rather than trusting the shape.

Two changes were repairs to things iteration 1 explicitly flagged, both of which this iteration made materially worse rather than merely untidy:

- `parseEntry` threw on any malformed entry, taking the whole knowledge base down at startup. Iteration 1's note read "Fine now with three hand-written files; hostile once the bot is writing them itself." That is now. `loadKnowledgeBase` skips and warns per file.
- The guard's `/:\d{1,5}\b/` pattern was flagged as "a false-positive waiting to happen" that would fire on a clock time like "charged at 09:00". Previously a false positive was a spurious warning on a hand-written file; now a hit **discards a derivation that cost about a dollar**. The pattern was also pure redundancy — `subscription.ts:142` is already caught by the filename pattern, because the extension ends at the colon. Removed.

Where a derived answer does leak code detail, the engine discards it rather than storing it. A stored entry is served to everyone who asks next, so a miss is the better failure.

### Why

The constitution requires that no call site know the engine is the Claude Agent SDK, and that answer structure and product-language rules live in the core. Both hold: `claudeEngine.ts` is the only file that imports the SDK, the rules live beside the `Answer` shape they serve, and `/src/index.ts` chooses between the real engine and the stub on one configuration value.

### What worked

Letting the schema carry the rules. The `answered` boolean matters more than it looks — a model handed a required `shortAnswer` field and no way to decline will invent one, and the PRD's whole position on trust depends on the bot not doing that.

### What didn't work

One typecheck failure, and it was a real design smell rather than a slip:

```
src/index.ts(53,40): error TS2322: Type '"engine" | "knowledge-base" | "miss"' is not assignable to type '"knowledge-base" | "miss"'.
```

`Turn.answeredFrom` in `/src/core/threadContext.ts` had re-declared the source union by hand instead of referencing it. Adding `'engine'` to `Answer['source']` desynchronised the copy. Fixed at the root by making it `answeredFrom: Answer['source']` rather than by widening the duplicate.

### What I learned

`StructuredOutput` shows up as a tool call in the transcript even though it is not in the `tools` allowlist — the SDK adds it when `outputFormat` is set. Restricting `tools` to `['Read', 'Grep', 'Glob']` does not break structured output, which was not obvious in advance and would have been an annoying thing to debug backwards from an empty result.

### What was tricky

Keeping `serializeEntry` and `parseEntry` honest inverses. Entry files are line-oriented markdown parsed by a deliberately dumb reader: sections are joined with spaces, list markers are stripped, and frontmatter lists split on commas. So a model-generated string containing a newline or a comma round-trips to something different from what was served. Both are normalised on the way out — whitespace collapsed to single spaces, commas stripped from keywords — and the round trip is asserted in the tests rather than assumed.

### What warrants review

- **`/src/core/claudeEngine.ts`** — discarding an entire derivation because one line trips `findCodeReferences` is the strict choice. It costs a real dollar and gives the asker a miss for what may be a single stray backtick. The alternative, storing a leaky answer, breaks a PRD rule for every future asker. Worth confirming the strict reading is wanted.
- **`/src/core/knowledgeBase.ts`** — `availableFile` never overwrites, so a question asked in two phrasings that both miss produces two near-duplicate entries (`-2`, `-3`). Nothing dedupes them, and keyword matching will then pick between them arbitrarily.
- **`/src/index.ts`** — `dangerouslyAllowUnauthenticatedRequests` is still inferred from `NODE_ENV`, and iteration 1 already flagged that it fails open. Unchanged this iteration, and now there is a real engine behind it.

### Future work

`findEntry` is still a keyword substring count, and it is now the thing standing between an asker and a dollar. A question phrased differently from the stored keywords misses and pays for a fresh derivation of an answer the knowledge base already holds.

## Step 3: Verifying it, hermetically and live

**Author:** main

### Prompt Context

**Verbatim prompt:** (continuation of the same `/loop` instruction — no new user prompt initiated this step)
**Interpretation:** Prove the iteration actually works rather than that it compiles.
**Inferred intent:** Iteration 1's hardest-won lesson was that a clean-looking run which proves nothing is more dangerous than a crash.

### What I did

Wrote nineteen behavioural checks covering the round trip between `serializeEntry` and `parseEntry`, resilience to a malformed entry, a knowledge-base hit not touching the engine, lazy population on a miss, the second asking coming back from the store, a miss storing nothing, and the guard's behaviour on both a real code reference and a clock time. All nineteen pass.

Then ran the real engine against a live codebase, and separately booted the app both with and without a codebase configured.

Every scratch file — the test, the live driver, the probe, and the throwaway knowledge bases they wrote into — lives outside the repository. Nothing derived during verification was committed, which also kept the three hand-written demo entries as the only contents of `/knowledge-base/`.

### Why

The success criteria for this iteration are behavioural — a miss gets answered from the codebase, the answer gets stored, the next asking is instant, and a leak never reaches an asker. A typecheck establishes none of that.

### What worked

The live run is the result worth recording. Asked *"How does the bot decide whether to search the code or answer from what it already knows?"* against the app's own source:

- First ask: 40 seconds, `source=engine`, a structured seven-step answer with ten edge cases, stored as `choosing-between-a-saved-answer-and-reading-the-codebase.md`.
- Second ask: **0 ms**, `source=knowledge-base`, byte-identical short answer.

That ratio — about a dollar and forty seconds once, then nothing forever — is the product's entire economic argument, and it is now observable rather than asserted.

The answer contained no file paths, function names, or snippets, despite the subject matter literally being source code, so the guard never had to fire. It also described the system's current limitations accurately and unprompted, including that thread history does not yet influence retrieval and that stored answers are served without a staleness check.

Choosing the target codebase carefully mattered. Pointing the engine at a private repository would have written its contents into a knowledge-base entry in a **public** repository. Analysing this app's own already-public source avoided that entirely while still being a real test.

### What didn't work

Four failures, three of them mine.

**A test that failed for a reason that was not a bug.** The first hermetic run reported four failures:

```
FAIL  miss is answered by the engine -- knowledge-base
FAIL  engine was called once -- calls=0
FAIL  entry was stored -- size=3
FAIL  engine not called again -- calls=0
```

The question I had chosen to be "uncovered" was *"how does a refund reach the customer?"*, and `refund` is a keyword on the existing `cancel-subscription-mid-period` entry. `findEntry` matched it correctly and never reached the engine. The code was right and the test was wrong. Rewrote the fixture around gift cards, which collides with nothing in `grep -H "^keywords:" knowledge-base/*.md`. Worth noting how easily this could have been "fixed" in the wrong direction.

**An inverted exit code.** The same test ended `process.exit(failures === 0 ? 1 : 2)` — success exiting non-zero. It never misreported anything because the PASS/FAIL lines were read directly, but as a gate it was backwards.

**A default budget that cut off real questions.** The first live run failed in 18 seconds:

```
[WARN] analysis did not complete (error_max_budget_usd)
```

`maxBudgetUsd` defaulted to `1`. Probing the SDK directly showed a real derivation costs `total_cost_usd: 1.1355494999999998` over 13 turns — the ceiling was just below the true cost. Not a bug, a badly chosen default; raised to `5` and documented. The degradation path was correct throughout: warn, return an honest miss, store nothing.

**A module resolution failure in the probe.** Writing the probe in the scratchpad with a bare package import failed:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@anthropic-ai/claude-agent-sdk' imported from /.../scratchpad/probe.mts
```

Bare specifiers resolve from the importing file's location, not the working directory. The earlier tests worked only because they imported the app's source by absolute path and the SDK was then resolved transitively from inside the project. Fixed by importing the installed entry point by absolute path. This is a near neighbour of iteration 1's scratchpad trap, from a different direction.

### What I learned

The cost of a derivation is a product fact, not an implementation detail. About a dollar per uncached question sets the value of retrieval quality directly: every question that misses because keyword matching is literal costs real money to answer twice. That reframes replacing `findEntry` from a tidiness concern into the highest-value work left.

Iteration 1's discipline about verification delays paid off again — `node -e "setTimeout(()=>{},4000)"` in place of an unavailable foreground `sleep`, and no chaining of cleanup behind a command whose failure would otherwise destroy the evidence.

### What was tricky

Distinguishing "the engine found nothing" from "the engine never ran" from "my test asked the wrong question." All three surface as a miss, which is the product's designed-in graceful degradation and therefore actively hides its own causes. Every failure path logs a distinct `[WARN]` for exactly this reason, and the keyword-collision failure was only diagnosable by reading the actual keywords out of the entry files rather than reasoning about what "should" have missed.

### What warrants review

- The nineteen checks live in the scratchpad, not the repository. There is still no test target in `/package.json`, so nothing re-runs them. Given the round trip between `serializeEntry` and `parseEntry` is now load-bearing — the bot writes files a strict parser must read back — that is the most conspicuous gap this iteration leaves.
- The live run was against the app's own source. That is a small, clean, TypeScript codebase with rich comments, which is close to a best case. Nothing has been tried against a large or poorly documented codebase, and both the 40-second figure and the one-dollar figure should be read as a floor.

### Future work

A `npm test` target holding the checks written here. Real retrieval in place of keyword matching, now with a measured cost argument behind it. Deduplicating entries that answer the same question under different phrasings. Verify-on-read, which now has the `derived-from` metadata it needs.
