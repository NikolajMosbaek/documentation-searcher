# Diary: Iteration 17 — a dry run, and the bug it walked into

The plan was the last small thing on the list: let seeding say what it would spend before spending it. Running that dry run for the first time reported thirteen questions as already answered by a knowledge base containing one entry.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Sixteenth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Added `--dry-run` to the seeding command, recorded as future work in iteration 7 and carried on the list since.

### Why

`--write` reported what it was about to spend and then spent it. Given a proposal can easily contain fifteen questions at roughly a dollar each, seeing the number before committing to it is worth having.

### What worked

Putting the estimate in `/src/core/seeding.ts` as `estimateCostUsd` rather than as a string inside the command. The bounds are a measured fact about this product — $0.60 to $1.15 an answer, from iterations 2 and 9 — and belong somewhere testable, with the measurement written down next to them.

Working out what is already covered is free, so the dry run reports which specific questions would be paid for rather than multiplying the total by a guess.

### What didn't work

Nothing failed in this step. The failure was in what the dry run then revealed.

### What I learned

Nothing new here.

### What was tricky

Nothing.

### What warrants review

The estimate's bounds come from two measurements on this codebase, which is small and heavily commented.

### Future work

None from this step.

## Step 2: What the dry run found

**Author:** main

### What I did

Ran it against the seeding plan from iteration 7 with every area ticked, and a knowledge base holding the single entry that iteration wrote:

```
13 questions ticked; 0 not yet covered.
Answering those would take about a minute each and cost roughly $0.00-$0.00.

covered   why did my question take almost a minute to answer?
covered   does it still remember my thread after the bot restarts?
covered   will it ever give me file names or code in an answer?
…
```

One entry, about flagging a wrong answer, was being treated as the answer to all thirteen. Measuring it:

```
HIT   score=1.47 cov=0.60  why did my question take almost a minute to answer?
HIT   score=1.65 cov=0.50  will it ever give me file names or code in an answer?
HIT   score=1.64 cov=0.67  does it still remember my thread after the bot restarts?
HIT   score=2.19 cov=1.00  how do I tell the bot that an answer is wrong?
miss  score=0.00 cov=0.00  what colour is the office carpet?
```

Only a question with no word in common missed. Everything else cleared both bars.

### Why it happens

Inverse document frequency measures how much a word narrows the field. With one document every word appears in every document, so every word gets the same weight, and the formula still awards weight rather than none. A long entry then matches almost any question that shares a few ordinary words with it.

This is worst exactly when a deployment starts. A new install has an empty or nearly empty knowledge base; a freshly seeded one has a handful. That is precisely when the bot is most likely to serve an answer to a question nobody asked.

Worse, it defeats the safeguard built for this. The second opinion from iteration 8 is only asked about candidates that fall *short* of the bars — a false positive that clears them is served without anything weighing it. Iteration 4's stated principle, that missing is the safe failure and a wrong hit is served silently to everyone afterwards, was being violated in the one situation nobody would think to test.

### What I did about it

Two changes.

A word appearing in every entry now scores zero, because it cannot distinguish between entries. That is true at any corpus size and happens to make the degenerate case degenerate correctly: on a single-entry base, nothing matches lexically at all.

That alone was not enough, and the test suite said so immediately — one test failed because the near-miss band on a single-entry base is now always empty, so the judge never runs. Fixing over-matching by disabling the thing that saves money on small bases is not a fix. So when lexical scoring produces *no* signal at all and the base has five entries or fewer, the whole base is offered for a second opinion. Cents to ask, against a dollar to derive.

The condition needed narrowing once more. An empty band because something cleared the bars is not the same as an empty band because nothing scored, and only the second is a shortage of evidence — the first already has an answer. A test caught that too, by asserting a confident hit is not among the candidates.

### What worked

The dry run finding this is the whole argument for building it. Nothing else would have: every earlier live run started from an empty knowledge base and asked one question, so the corpus was never small-but-not-empty in the presence of unrelated questions.

### What didn't work

The failures were mine, in sequence, and each was caught by a test rather than by inspection: the first fix disabled the judge on small bases, and the second version of the fallback offered candidates even when a confident hit existed.

### What I learned

Iteration 4 wrote down that three entries was too small a corpus to tune thresholds against, and expected the problem to appear as the knowledge base *grew*. It appears at the other end, and more sharply: the thresholds were calibrated where they were least meaningful, and the direction of error was toward answering rather than missing.

### What was tricky

Deciding to take it on at all. The iteration was meant to be a flag on a command, and this is a change to how retrieval scores everything. Leaving it would have meant knowingly shipping a bot that answers the wrong question during exactly the period a new user is deciding whether to trust it.

### What warrants review

- **Five is a chosen number**, not a measured one. It is the point below which a corpus is treated as too thin for statistics.
- **On a small base, a question matching nothing now costs a judge call** — a few seconds and cents. Cheaper than deriving, but no longer free.
- **Zeroing universal terms changes scoring at every size.** The existing tuning tests still pass, but the thresholds were calibrated before it.

### Future work

Re-tune both bars against a knowledge base of tens of entries. That was already recorded in iteration 4 and this makes it more pressing, because the scoring underneath has changed.

## Step 3: Verifying it

**Author:** main

### What I did

Grew the suite to eighty-eight, then re-ran the exact dry run that found the bug.

### Why

The bug was found by running a real command against real data. The fix should be confirmed the same way, not only by the tests written alongside it.

### What worked

The same command, before and after:

```
before: 13 questions ticked; 0 not yet covered.   $0.00-$0.00
after:  13 questions ticked; 12 not yet covered.  $7.20-$13.80
```

The single question still reported as covered is the one that created the entry, matched by the exact-question guarantee rather than by scoring — which is exactly the guarantee behaving as designed.

Checking the same one-entry base directly shows the new shape: nothing is served on lexical evidence, and the single entry is offered as a candidate for a second opinion instead.

### What didn't work

Nothing, in the end. Both intermediate versions of the fix were wrong and both were caught by the suite rather than by me re-reading the code.

### What I learned

The tests earned their keep in a way they had not before tonight. Every previous iteration used them to confirm work; here they twice rejected a fix that looked right, in a part of the system where the failure is silent and the correct behaviour is not obvious from reading.

### What was tricky

Keeping the tests honest while the behaviour underneath them changed. Two asserted things that were true before and are deliberately false now. The temptation is to relax them until they pass; what they were protecting — that a confident hit needs no second opinion, and that a judge is not asked to weigh nothing — is still true, and both were rewritten to assert it on a corpus large enough for the statement to mean something, with new tests covering the small-corpus behaviour.

### What warrants review

The fix has not been through the soak, which starts from an empty knowledge base and would exercise the one-entry case only in passing.

### Future work

Run the soak against a knowledge base seeded with a handful of entries rather than an empty one. Every soak so far has tested the empty case.
