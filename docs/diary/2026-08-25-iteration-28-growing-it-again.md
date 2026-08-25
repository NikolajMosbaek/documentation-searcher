# Diary: Iteration 28 — growing it again

The previous iteration claimed that what replaced the retrieval thresholds "does not care how large the corpus is". That was nearly true. One number still did, and growing the knowledge base from twenty-four entries to thirty-one caught it a step before it broke.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Twenty-seventh firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Grew the corpus again and re-ran everything, which is what iteration 26 wrote down as its own next step.

### Why

Iteration 26 made a strong claim on the back of one doubling: that deleting the tuned thresholds made the design indifferent to corpus size. A claim like that is worth attacking rather than repeating, and the way to attack it is the way that produced it.

### What worked

Asking the bot what was left to document. The proposal came back with eight areas and twenty-four questions, most of them covering ground the corpus already holds — which turned the run into two experiments rather than one.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing yet.

### What was tricky

Nothing.

### What warrants review

The new entries are still about this bot.

### Future work

None from this step.

## Step 2: The skip, measured by accident

**Author:** main

### What I did

Ran all twenty-four proposed questions through seeding against the existing twenty-four-entry corpus.

### What worked

The result is a better measurement of iteration 26's judge-backed skip than anything designed for it:

```
Wrote 7 of 24 for $4.95.
```

Seventeen of twenty-four questions were recognised as already covered, each naming the entry that covers it:

```
[7/24] already covered by why-an-answer-is-labelled-possibly-out-of-date.md, skipping:
       why does this answer say it might be out of date?
[11/24] already covered by telling-the-bot-an-answer-is-wrong.md, skipping:
       if I say the answer is wrong, will it just change the answer to agree with me?
```

Both of those are correct, and neither shares enough wording with its entry to have been caught before iteration 26 replaced the lexical check with a judge.

Seventeen skips at roughly two cents each, instead of seventeen derivations at roughly seventy-five. About twelve dollars saved for about thirty-four cents — and the seven that were genuinely new got written.

### What didn't work

Nothing.

### What I learned

The skip is worth more than the merge. Both exist to stop the knowledge base filling with entries that say the same thing; the merge cleans up after the fact and, as iteration 26 established, cannot separate duplicates from neighbours reliably. The skip prevents the duplicate being created, using a judgement rather than a similarity score, and it just declined seventeen of twenty-four without a wrong call.

That was not the plan. The skip was added in iteration 26 as a consequence of removing lexical decisions — something that had to be fixed so seeding would not re-derive. It turns out to be the better half of the deduplication story.

### What was tricky

Nothing.

### What warrants review

**Seventeen skips, none obviously wrong, judged by reading them.** If one were wrong the effect is invisible: a question that should have been documented silently is not.

### Future work

None.

## Step 3: The number that was still drifting

**Author:** main

### What I did

Re-measured everything at thirty-one entries.

### What worked

The evaluation passed, which was not the interesting part:

```
corpus 31
  10  if the bot has never seen my question before, what does it do?
   4  is anything written down when it works out a new answer?
   2  how does it know an answer went stale?
   1  (the other seven)
```

The hardest question's answer sits at rank **ten**, against a shortlist of exactly ten. It ranked ninth at twenty-four entries. One more entry and the judge would never have seen it.

So iteration 26's claim was overstated. Deleting three thresholds removed three numbers that grew wrong with the corpus, and left one: how many candidates the judge is shown. It was fixed at ten, measured at twenty-four entries, and drifting.

The shortlist now scales — half the knowledge base, never fewer than ten, never more than twenty. At thirty-one that is sixteen, which puts three entries of margin under the worst case.

Erring large is close to free, which is what makes the fraction safe: the number of *unrelated* questions that get shortlisted is identical at five, ten, fifteen and twenty, measured at both corpus sizes. A longer list costs judge prompt tokens and nothing else.

Then the check that mattered — a longer shortlist could plausibly make the judge's job harder:

```
Questions the knowledge base answers (10):
  rescued by the judge       : 10
  wrong entry chosen         : 0
Questions it does not (7):
  ANSWERED WRONGLY           : 0
```

Sixteen candidates, thirty-one entries, ten of ten. It does not.

### What didn't work

Nothing failed, but the pattern is worth naming because it has now happened three times. Iteration 19 measured thresholds at twelve entries; they broke at twenty-four. Iteration 26 measured a shortlist at twenty-four; it was one entry from breaking at thirty-one. Iteration 22 measured a merge bar at twelve; iteration 26 found the gap it sat in no longer existed.

Every number measured against a corpus has needed re-measuring at the next size, and every time the previous iteration believed it had settled the question. The current answer — a fraction with a cap — is the first that adapts rather than being re-fitted, and the cap is the part that will fail.

### What I learned

The honest form of the claim iteration 26 made is narrower than what it wrote. Removing decisions from a scoring function does make the *decision* scale-independent, because the judge reads rather than counts. It does not make the *plumbing* scale-independent, and how much you show a judge is plumbing.

### What was tricky

Resisting a second fixed number. Raising ten to twenty would have passed every test tonight and moved the same failure a corpus-doubling further away.

### What warrants review

- **The cap of twenty is a guess**, unlike the fraction. Nothing has measured a knowledge base large enough for it to bind.
- **Two data points define the drift** — rank nine at twenty-four, rank ten at thirty-one. That is a trend line through two points.
- **Thirty-one entries, two subjects.**

### Future work

The next person to grow this knowledge base should re-run `npm run judge-eval` and look at where the answers rank, not just whether they were found.
