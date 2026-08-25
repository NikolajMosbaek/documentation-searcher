# Review backlog

Every diary in `docs/diary/` ends with *What warrants review*. Across twenty-eight iterations that is upwards of a hundred and thirty notes, written one at a time and never read together.

This is that list, triaged. It was assembled at iteration 21 and rewritten at iteration 29 to reflect everything since — several of those iterations closed items on it, and one of them was closed *because* the list existed.

Most items are closed. What remains is grouped by what someone reading this actually needs to decide.

---

## Open — worth attention

Ordered by how much damage the item can do.

### One model decides almost everything

Since iteration 26, retrieval does not decide anything. It ranks entries and hands a shortlist to a model, which chooses. The only question answered without asking anybody is one that has been asked before in exactly the same words.

That was the right call and it is measured — deciding by word-counting served two wrong answers out of seventeen questions at twenty-four entries, and the judge has served none across two corpus sizes. But it concentrates correctness in one place. If the judge is unavailable, every non-repeat question falls through to a fresh derivation at about a dollar: expensive rather than wrong, which is the right failure, but not free.

`npm run judge-eval` measures it. It costs money and so is not in CI, which means the only automated checks cover everything *except* the decision.

### Every number measured against a corpus has needed re-measuring at the next size

Three times now:

| Measured | At | Broke at |
| --- | --- | --- |
| Retrieval's score, coverage and margin thresholds | 12 entries | 24 — two wrong answers |
| The merge similarity bar | 12 entries | 24 — the gap it sat in stopped existing |
| The shortlist size | 24 entries | 31 — one entry from losing an answer |

The current shortlist rule is a fraction of the knowledge base rather than a fixed number, which is the first of these that adapts instead of needing re-fitting. Its cap of twenty is still a guess, and nothing has measured a knowledge base large enough for the cap to bind.

Everything measured tonight was measured on thirty-one entries about two subjects — this bot, and a fictional subscription-billing service.

### The safety of a correction rests on a paragraph of English

`asGuidance` is what stops the correction path becoming "anyone can rewrite the knowledge base by asserting things". Nothing enforces it structurally.

Measured in iteration 25 against four objections of escalating plausibility. In all three cases where the path actually ran, the bot re-read the code and contradicted the objector — including a confident, specific, numerical false claim. That is evidence, not proof: four objections, one entry, one model.

### Near-duplicates accumulate on purpose

Two entries only merge if they were derived against byte-identical code, and iteration 26 showed similarity cannot separate duplicates from neighbours anyway. Three entries in the current corpus describe staleness and nothing will ever merge them.

The mitigation is upstream and works well: seeding asks the judge whether a question is already covered before paying to answer it, and declined seventeen of twenty-four in iteration 28. That prevents duplicates being created; nothing cleans up the ones that exist.

### The knowledge base is per-process, and forgets on restart

Thread context, the dispute cooldown, and the spend tally all live in a `Map`. A restart forgets them; two instances share none of it. A deliberate deferral, worth knowing about.

### A reformat of the codebase invalidates every entry

Staleness is byte-level. A formatting pass, a licence header, a lint fix — each invalidates every entry touching a changed file, and each costs about a dollar to re-derive on the next question.

### Questions are written into files and into logs

An asker's exact words are stored in the entry they produce and printed in every `[SPEND]` line, next to a conversation id that is trivially correlated with a person by anyone with tenant access. Nothing sensitive can reach either today because no real asker has used this.

### It has never run inside Teams

Only against the protocol. That needs a tenant, and it is the one thing here that cannot be verified without one.

---

## Smaller, and cheap to fix

- **`judge-eval` measures the judge against entries about this bot.** Pointed at another knowledge base it needs labels for that one, and nothing provides them.
- **Half the labelled evaluation data is mine.** Only the negatives — thirteen questions written by a model — are independent.
- **Comments in tests carry measurements that nothing checks.** There are a lot of them now, and one had already gone quietly wrong before iteration 27 caught it.
- **The dispute patterns are fourteen alternatives**, each added for a measured miss, each a chance for a false positive no test set covers.
- **"we changed that last sprint" counts as a dispute.** A claim that the code moved, not that the answer is wrong. Defensible, and the loosest of them.
- **The index rebuilds completely on every write.** Linear in the corpus.
- **`spendByThread()` has no caller** outside tests.
- **`--write` has no resume record.** Re-running is safe — it was resumed by accident in iteration 26 — but nothing says so.
- **The drift test reads the README with regular expressions**, so restructuring headings can break it without anything being wrong.
- **Every spend figure quoted in diaries before iteration 25 is an undercount**, by whatever the failed attempts in those runs cost.

---

## Decisions that are yours, not mine

Each of these was called deliberately and could reasonably have gone the other way.

1. **The PRD's two open questions are still open.** Whether the bot may propose changes to the code rather than only describing it, and whether access control is needed.
2. **Seeding is driven by a command, not by Teams.** The PRD puts "a CLI front end" out of scope; iteration 7 read that as being about the *asking* interface. A stricter reading rejects that iteration outright.
3. **`Core.ask` returns an `Exchange`, not an `Answer`**, against the constitution's sketch.
4. **A staleness caveat is prepended by `formatAnswer`**, which the PRD's fixed answer shape does not include.
5. **Merging is automatic and irreversible** where it fires at all.
6. **The resolver and judge stay on the agent harness**, trading about 3.2 seconds of fixed overhead per call against not needing an API key. A deployment that already has one should reverse this.
7. **Every question but an exact repeat now costs a model call** — a few seconds and a few cents — to avoid serving confident wrong answers.

---

## Accepted, with reasons

- **A derived answer mentioning code is discarded, not stored.** A miss is a better failure than an entry served to everyone.
- **The judge is told to choose nothing when unsure.** Measured: it declined nothing it should have rescued, across two corpus sizes.
- **`looksDependent` wrongly flags most standalone questions.** The cheap direction, by about twenty to one.
- **Follow-ups and near misses cost seconds**, which is fixed harness overhead rather than inference.

---

## Closed during the run

Flagged, then fixed — usually by an iteration that did not know it was closing anything.

| Flagged | Item | Closed |
| --- | --- | --- |
| it1 | A clock time trips the code-reference guard | it2 |
| it1 | One malformed entry takes down the knowledge base | it2 |
| it1 | `ask` accepts a thread and ignores it | it5 |
| it1 | `findEntry` is a substring count, not retrieval | it4, then removed entirely it26 |
| it1, it2 | Unauthenticated requests accepted unless `NODE_ENV=production` | it21 |
| it2 | `derivedFrom` is written and read by nothing | it3 |
| it2 | Two phrasings produce near-duplicate entries | it12, then it26's skip |
| it2, it3 | The test suite lives in a scratch directory | it4 |
| it4 | The build compiles tests into `dist` | it11 |
| it4 | Thresholds tuned against three entries | it19, then deleted it26 |
| it6 | Nothing rate-limits a dispute | it9 |
| it6 | Disputes phrased unusually are not recognised | it23, it25 |
| it7 | `--write` spends without a preview | it17 |
| it7 | The seeding write loop untested beyond one question | it26 |
| it9 | Spend is logged but not attributed | it15 |
| it9 | Failed attempts spend money invisibly | it25 |
| it10 | The soak's questions only suit this codebase | it16 |
| it10 | A provenance value doing two jobs produced a contradictory answer | it10 |
| it12 | The merge bar was above every real duplicate | it22 |
| it13 | Nothing checks the README against the code | it14 |
| it17 | The cold-start fix never went through the soak | it20 |
| it19 | The judge moved onto the critical path untested | it20, measured it24 |
| it26 | A fixed shortlist loses answers as the corpus grows | it28 |
| it10 | Soak workspaces accumulate in the temp directory | it30 |
| it11 | CI never checks an iteration branch before it lands | it30 |
| it11 | Actions pinned to a moving tag in a public repository | it30 |
