# Diary: Iteration 4 — retrieval that retrieves, and a suite to make it safe

Two things that belonged together. Lookup was still the substring keyword count iteration 1 wrote as a placeholder, and the tests proving iterations 2 and 3 worked were still sitting outside the repository where nothing would ever run them again. Replacing lookup is precisely the change those tests exist to catch, so the safety net shipped with the thing it protects.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Third firing of the same self-paced loop. Take the recommendation and build it.

**Inferred intent:** Cumulative overnight progress, one reviewable iteration at a time.

### What I did

Weighed retrieval against guided seeding and thread-context follow-ups, and took retrieval — bundled with moving the test suites into the repository behind `npm test`.

### Why

Retrieval had the measured argument: about a dollar per derivation, and any question phrased differently from the entry that answers it pays that again for an answer already on disk. Seeding fills a store whose lookup does not work well; follow-ups are smaller.

The bundling was the real decision. I had flagged the uncommitted suites as the top risk at the end of both previous iterations, which is twice too many. More to the point, `findEntry` is load-bearing for both of the last two iterations: staleness is only ever checked on a hit, and the findability guarantee from iteration 3 lives inside that function. Rewriting it with no committed regression tests is how you silently undo two iterations of work.

### What worked

Treating "write the tests" as part of the iteration rather than a chore alongside it. It also meant the thresholds below could be tuned against something runnable.

### What didn't work

Nothing failed in this step.

### What I learned

A note that says "this is the biggest risk" and does not change what gets built next is not a risk assessment, it is a worry. The second time I wrote it, it should have already been fixed.

### What was tricky

Judging whether a test harness belongs in an iteration at all, given the constitution's "defer infrastructure" principle. It does not apply: that principle is about databases, queues, and auth — things the product would depend on at runtime — not about being able to tell whether the product works.

### What warrants review

Whether bundling two concerns into one iteration was right. The commit is larger than the previous two and does two separable things.

### Future work

Guided seeding and thread-context follow-ups remain untouched.

## Step 2: Building retrieval

**Author:** main

### What I did

Added `/src/core/retrieval.ts`: BM25 over the entries, in-memory, built at load and rebuilt whenever an entry is written. It indexes five weighted fields — keywords, title, the stored question, the short answer, and the body — where the old matcher only looked at keywords.

Tokenisation drops function words and applies a crude stemmer, enough to unify `cancel`/`cancels`/`cancelling` so an asker's phrasing reaches an entry written in another. Everything else is left to inverse document frequency, which demotes a common word without anyone having to predict which words those are.

`findEntry` keeps two mechanisms in a deliberate order: the exact-question guarantee from iteration 3 first, then retrieval. Neither subsumes the other. The exact question is a promise to whoever paid for the entry; retrieval is a judgement about everyone else.

A match must clear both a score bar and a coverage bar — the share of the question's content words that appear in the entry at all. Score alone rewards a long entry containing one rare word; coverage alone rewards a short entry containing several common ones.

### Why

Missing is the safe failure and a wrong hit is the dangerous one. A miss costs a re-derivation, which is expensive but correct. A wrong hit is served silently to everyone who asks that question afterwards, and — because iteration 2's guard only checks for code references, not for relevance — nothing downstream would catch it. So both bars are set to prefer missing.

### What worked

Tuning against a written-down table rather than by feel. Sixteen questions with the entry each should reach, or `null` for the ones nothing covers, printed as a grid of want/got/score/coverage. That turned threshold-picking from a judgement into a measurement, and it is now a committed test.

The separation it revealed is stark: every question the knowledge base genuinely does not cover scored exactly `0.00`. Not "below threshold" — zero, because no content word overlapped at all. There is a great deal of headroom between the negatives and the positives.

### What didn't work

Fifteen of sixteen. The failure:

```
✗ cancel-subscription-mid-period.md (miss)   0.27  0.25  what happens if I cancel halfway through the month?
```

Coverage `0.25` means one of the four content words in the question — `cancel`, `halfway`, `through`, `month` — appears in the entry. The entry says "mid-period"; the question says "halfway through the month". They mean the same thing and share almost nothing.

I chose not to fix this by lowering the thresholds. With all the negatives at `0.00` there is room to, but catching this case would be catching it *by accident* rather than by signal: the evidence really is one common word, and on a larger corpus the same setting would start admitting noise. It is recorded as a committed test asserting that it misses, with a comment saying why, so a future change that makes it hit will show up as a deliberate decision rather than a silent drift.

### What I learned

Three entries is not enough corpus to tune a threshold responsibly, and I should not pretend otherwise. IDF depends on the corpus, so both bars will need revisiting once the knowledge base holds tens of entries rather than three. The values are conservative and named constants for that reason.

### What was tricky

The stemmer. `cancelling` strips to `cancell`, which does not match `cancel`, so it needs a doubled-consonant rule after suffix removal. Meanwhile `expires` stems to `expire` and `expiry` stays `expiry`, and no reasonable amount of crude stemming unifies those — the entry happens to carry both as keywords, which papers over it. Knowing when to stop making the stemmer cleverer was most of the work.

### What warrants review

- **`MIN_SCORE` and `MIN_COVERAGE` in `/src/core/retrieval.ts`** — tuned against three entries and sixteen questions. Treat as provisional.
- **The index rebuilds fully on every write.** Fine at this size, linear in the corpus, and it will not stay fine.
- **`findEntry` builds a throwaway index per call.** `createKnowledgeBase` caches one, so the product path is fine, but the exported convenience function is O(corpus) per question and is easy to reach for by mistake.

### Future work

The semantic gap is what remains. A re-ranking pass by a cheap model over the top few candidates would close it for a fraction of a derivation, and would fit behind an interface the way the analysis engine does. Embeddings would close it better and mean storage, which the constitution defers.

## Step 3: The suite, and verifying the claim

**Author:** main

### What I did

Moved the checks into the repository as four files — `/src/core/retrieval.test.ts`, `/src/core/knowledgeBase.test.ts`, `/src/core/sourceIndex.test.ts`, `/src/core/core.test.ts` — using `node:test` and `node:assert`, run by `npm test` through `tsx`. Twenty-four tests, no network, no credentials, temporary directories under the OS temp dir.

They are written around behaviour rather than implementation: that a malformed entry does not take the knowledge base down, that refreshing rewrites the same file instead of adding another, that a hand-written entry is never called stale, that the question which paid for an entry always finds it again, that a path escaping the codebase is never read.

Then ran the real engine to test this iteration's actual claim: that a *bot-written* entry — whose keywords are the model's words, not mine — is findable by a rephrased question.

### Why

The hermetic suites of iterations 2 and 3 both used fakes I had written, and iteration 3's diary recorded exactly what that costs: "a fake you wrote and a model you did not will agree with each other far more than either agrees with reality." Tuning retrieval against three hand-written entries with curated keywords is the same trap. The claim had to be tested against keywords the model chose.

### What worked

The live run. One derivation, 67 seconds, and the model chose keywords like `staleness`, `outdated`, `fingerprint check` — its words for the behaviour, not anyone's words for a question. Then three rephrasings, none of them the question that paid for the entry:

```
HIT   0ms  free  -- how does the bot know an answer has gone stale?
HIT   1ms  free  -- what if the code changed since the answer was written?
HIT   0ms  free  -- does it re-check saved answers against the current code?
MISS  8377ms  PAID  -- what colour is the office carpet?
```

All three rephrasings hit for nothing, and the unrelated question correctly missed and went to the engine, which correctly found nothing.

### What didn't work

Nothing failed, but my first reading of that result was wrong and worth recording as such.

I was about to report it as three rephrasings converted from paid misses to free hits. Before writing that down I ran the *old* substring matcher against the same keywords, and it would have hit two of the three anyway — `code changed` and `re-check` happen to appear literally inside those two questions:

```
MISS  old substring matcher  []              -- how does the bot know an answer has gone stale?
HIT   old substring matcher  [code changed]  -- what if the code changed since the answer was written?
HIT   old substring matcher  [re-check]      -- does it re-check saved answers against the current code?
```

So the honest number is one of three converted, not three of three. The measured saving in this sample is about a dollar, not three.

### What I learned

The real improvement is not the hit count, it is what the hits depend on. The old matcher's two successes were luck: they required the model to have emitted a keyword that is a literal substring of the asker's question, which nothing arranges and nothing guarantees. Retrieval scores partial and stemmed overlap across the entire entry, so it degrades gradually rather than falling off a cliff when a phrasing changes by one word. A benchmark with three samples cannot show that, and quoting "three of three" would have been a claim my own evidence did not support.

### What was tricky

Resisting a number that flattered the work. The three-of-three reading was available, superficially true, and would never have been checked by anyone. Running the comparison took one command and changed what the iteration is allowed to claim.

### What warrants review

- **The live comparison was a sample of three questions on one entry.** It is an illustration, not a benchmark, and the diary should not be read as having measured a hit-rate improvement.
- **Tests are compiled into `dist` by `npm run build`**, since `tsconfig.json` includes all of `src`. Harmless for a bot that is never published, untidy if that changes.

### Future work

The tuning table in `/src/core/retrieval.test.ts` is the natural place to grow a real evaluation set. Every question a real asker misses on is a row that belongs in it.
