# Review backlog

Every diary in `docs/diary/` ends with a section called *What warrants review*. Across twenty iterations that came to **108 entries**, written one at a time, never read together, and therefore never acted on as a whole.

This is that list, triaged. It was assembled by reading all twenty diaries in one pass at the end of the run.

Most items are closed: a later iteration fixed them, usually without noticing it was closing a flag. What remains is grouped by what someone reading this actually needs to decide.

---

## Open — worth attention

Ordered by how much damage the item can do, not by how hard it is.

### The safety of a correction rests on a paragraph of English

Measured in iteration 25 against four objections of escalating plausibility — flatly false, plausible and specific, claiming authorship, and a true detail with a false one attached. In all three cases where the correction path actually ran, the bot re-read the code and contradicted the objector. The fourth was not recognised as a dispute at all, which is now fixed.

Still only four objections, one entry, one model, and the property is still a paragraph of English with nothing enforcing it.

`asGuidance` in `/src/core/correction.ts` is what stops anyone in a chat thread rewriting the knowledge base by asserting things. It works by telling the engine that an objection is a hint and not evidence, and that it should contradict the objector when the code does. Nothing enforces that structurally. An engine that ignored the instruction would write the objector's claim into a file.

It was verified once, live, against one deliberately false objection, and it held. That is evidence, not a guarantee.

*Suggested:* compare a re-derived answer against the one it replaces and flag a reversal for human review, so a capitulation is visible rather than silent.

### Everything measured so far was measured on twenty-four entries about two subjects

The corpus was doubled in iteration 26 and everything re-measured. Two results changed:

- **Retrieval's three thresholds were deleted.** They served nothing wrong at twelve entries and two wrong answers at twenty-four. Retrieval now only shortlists.
- **The merge bar can no longer separate duplicates from neighbours.** It is set for safety and catches only obvious cases.

Both are the same lesson: a number measured on a small corpus does not survive a larger one. The corpus is still about this bot and subscription billing, and the next doubling may move these again.



`MIN_SCORE`, `MIN_COVERAGE` and `MIN_MARGIN` were measured in iteration 19 against a real corpus, which is a great deal better than the guesses they replaced — but that corpus is this bot and subscription billing, and nothing else. Iteration 19 also showed the previous settings were not merely mistuned but *inert* at that size, which is a reminder that a threshold correct at twelve entries may be meaningless at two hundred.

The measuring harness is committed (`/src/core/retrievalEvaluation.test.ts`, `/src/core/fixtures/corpus/`), so re-running it is a matter of adding entries rather than building anything.

### The knowledge base is per-process, and forgets on restart

Thread context, the dispute cooldown, and the spend tally all live in a `Map`. A restart forgets them, and two instances share none of it. That is a deliberate deferral — the constitution says fake it until a fake cannot cut it — and it is worth knowing that the fake currently cannot survive a deployment restart or a second replica.

### A reformat of the codebase invalidates every entry

An entry is stale when the *bytes* of the files it came from change. A repository-wide formatting pass, a licence header, a lint fix — each invalidates every entry that touched a changed file, and each of those costs roughly a dollar to re-derive on the next question. Nothing bounds this beyond `DOCSEARCHER_MAX_USD` per question.

### Questions are written into files and into logs

An asker's exact words are stored in the entry they produce and printed in every `[SPEND]` line, alongside a conversation id that is opaque but trivially correlated with a person by anyone with tenant access. Nothing sensitive can reach either today because no real asker has used this. That changes on the day one does.

### Two heuristics decide things a regex cannot really decide

`looksDependent` decides whether a question leans on the conversation; `looksLikeCorrection` decides whether a message disputes the last answer. Both are regexes standing in for understanding, deliberately biased in opposite directions.

Measured in iteration 23. `looksLikeCorrection` was missing ten of eighteen ordinary ways of saying an answer is wrong — the correction path was not firing for most real phrasings — and has been widened; it now catches all eighteen while still passing thirteen model-written questions that are not disputes.

`looksDependent` catches every follow-up tried, and wrongly flags nine of thirteen genuinely standalone questions, because a question about a bot naturally says "it". That is left alone: a false positive costs a rewrite that returns the question unchanged, and a false negative costs a derivation. Both sets of examples are committed as tests.

What remains: the positive examples are mine, so they share an author with the patterns. Only the thirteen standalone questions are independent data.

### Merging is automatic, irreversible, and only fires within one code state

When two derivations say the same thing about the same code, the newer one wins and the older wording is discarded; only its question survives.

The similarity bar was re-measured in iteration 22 against the two pairs this engine genuinely produced twice, and moved from 0.6 to 0.35 — the old value sat above every real duplicate, so the merge could not fire at all. What remains open is the other half of the rule: it requires an identical content hash, so two entries derived either side of any code change never merge however alike they are. Near-duplicates can still accumulate over time. A looser rule based on overlapping file lists was measured and rejected.

### It has never run inside Teams

Only against the protocol. That needs a tenant, and it is the one thing in this project that cannot be verified without one.

---

## Smaller, and cheap to fix

- **The index rebuilds completely on every write**, and the exported `findEntry` builds a throwaway index per call. Linear in the corpus; fine now.
- **`seed-plan.md` is not gitignored**, so a half-edited plan can be committed by accident. Left that way deliberately so it *can* be committed as a record.
- **Soak workspaces accumulate** under the system temp directory; they are kept for inspection and never cleaned up.
- **CI does not run on iteration branches**, only `main` and pull requests — and the pull-request half has still never fired.
- **GitHub Actions are pinned to `@v5`**, a moving tag, in a public repository.
- **`spendByThread()` has no caller** outside tests; operators read the log lines.
- **The soak runner's wiring is untested** — which scenario field reaches which turn was checked by reading.
- **`--write` has no resume**: a run that dies halfway leaves entries written and no record of where it stopped. Re-running is safe, but nothing says so.
- **The fingerprint is truncated to 16 hex characters.**
- **The drift test reads the README with regular expressions**, so restructuring headings can break it without anything being wrong.

---

## Decisions that are yours, not mine

These were called deliberately during the run, and each could reasonably have gone the other way.

1. **The PRD's two open questions are still open.** Whether the bot may propose changes to the code rather than only describing it, and whether access control is needed. Both were recorded as undecided in the PRD and neither has been decided since.
2. **Seeding is driven by a command, not by Teams.** The PRD puts "a CLI front end" out of scope. Iteration 7 read that exclusion as being about the *asking* interface, on the grounds that its stated reason is about serving people without a terminal, and that seeding's own user story begins "As a developer setting this up". A stricter reading of "Teams is the only interface" rejects that iteration outright.
3. **`Core.ask` returns an `Exchange`, not an `Answer`.** The constitution sketches `ask(question, threadContext) → answer`. It returns the resolved question alongside it, because a caller recording the conversation needs to know what the question was taken to mean.
4. **A staleness caveat is prepended by `formatAnswer`.** The PRD fixes the answer's shape; this adds a line above it. The alternative is withholding an answer that is probably still right.
5. **Merging, rather than keeping both entries.** Keeping both loses nothing and costs storage.
6. **The resolver and judge stay on the agent harness.** Iteration 9 measured about 3.2 seconds of fixed overhead per call and declined to migrate to a plain API client, because that trades latency for an API key to provision and protect. A deployment that already has a key should reverse that.

---

## Accepted, with reasons

Recorded so nobody spends time rediscovering them.

- **A derived answer that mentions code is discarded, not stored.** Costs a real derivation for what may be one stray backtick. A stored entry is served to everyone afterwards, so a miss is the better failure.
- **The judge is told to choose nothing when unsure.** Its false negatives are invisible and cost a derivation; its false positives would answer a question nobody asked. Measured in iteration 24 on the committed corpus: of ten answerable questions it rescued eight and picked none wrongly, and of seven unanswerable ones it declined every one that reached it. Re-runnable with `npm run judge-eval`.
- **Follow-ups and near misses cost seconds.** Measured as fixed harness overhead, not inference — a smaller model was slower.
- **Most repeat questions now cost cents and seconds rather than being instant and free.** That is iteration 19 buying a ~30% reduction in wrong answers.

---

## Closed during the run

Flagged, then fixed — usually by an iteration that did not know it was closing a flag.

| Flagged | Item | Closed |
| --- | --- | --- |
| it1 | A clock time like "09:00" trips the code-reference guard | it2 |
| it1 | One malformed entry takes down the whole knowledge base | it2 |
| it1 | `ask` accepts a thread and ignores it | it5 |
| it1 | `findEntry` is a substring count, not retrieval | it4, remeasured it19 |
| it1, it2 | **Unauthenticated requests accepted unless `NODE_ENV=production`** | **it21** |
| it2 | `derivedFrom` is written and read by nothing | it3 |
| it2 | Two phrasings produce two near-duplicate entries | it12 |
| it2, it3 | The test suite lives in a scratch directory | it4 |
| it3 | An entry can only be found by keywords, not by the question that made it | it3 |
| it4 | The build compiles tests into `dist` | it11 |
| it4 | Thresholds tuned against three entries | it19 |
| it6 | Nothing rate-limits a dispute | it9 |
| it7 | `--write` spends without a way to preview | it17 |
| it9 | Spend is logged but not attributed | it15 |
| it10 | The soak's questions only suit this codebase | it16 |
| it10 | A provenance value doing two jobs produced a self-contradictory answer | it10 |
| it12 | Merging never exercised by a real run | it18, it20 |
| it13 | Nothing checks the README against the code | it14 |
| it17 | The cold-start fix never went through the soak | it20 |
| it19 | The judge moved onto the critical path untested | it20 |
