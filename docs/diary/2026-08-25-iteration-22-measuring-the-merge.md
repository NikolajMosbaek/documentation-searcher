# Diary: Iteration 22 — the merge that could never have fired

Iteration 12 added a rule for collapsing two entries that say the same thing, and flagged that no real pair of derivations had ever been merged. The evaluation corpus committed seven iterations later contains two such pairs. Measuring them showed the rule could not have fired on either.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Twenty-first firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Measured `DUPLICATE_SIMILARITY` against real duplicates, having realised the data was already committed.

### Why

The backlog assembled in the previous iteration made the pattern obvious: almost everything genuinely open is something never measured at realistic scale. This one turned out not to need any new data at all.

Iteration 12's own note reads: "No real pair of derivations has ever been merged. Every merge test uses fixtures I wrote, and the 0.636 figure comes from two sentences I composed to resemble a re-derivation rather than from two actual ones." Iteration 19 then collected twelve real entries into a corpus and observed, in passing, that two pairs of them were the same question answered on different runs.

The measurement iteration 12 wanted had been sitting in the repository for three iterations.

### What worked

Reading the backlog and the corpus together. Neither observation is useful alone; the pair of them is a measurement waiting to be taken for nothing.

### What didn't work

Nothing failed in this step.

### What I learned

Consolidating the flags was worth more than the one security fix it produced. This is the second thing it has surfaced, and it surfaced it by making two facts visible at the same time that had been three iterations apart.

### What was tricky

Nothing.

### What warrants review

Two pairs is a small sample for calibrating anything.

### Future work

None from this step.

## Step 2: What the real duplicates score

**Author:** main

### What I did

Measured both pairs, then measured every pair in the corpus for context.

### Why

Two numbers say whether the bar is wrong. Sixty-six say whether a bar can work at all.

### What worked

The measurement is unambiguous:

```
REAL duplicate pairs -- the same question, derived on different runs

similarity 0.400  vs merge bar 0.600  -> NOT similar enough
similarity 0.500  vs merge bar 0.600  -> NOT similar enough
```

Both genuine duplicates score below the bar meant to catch them. The bar sat above every real duplicate this project has ever produced, so the merge added in iteration 12 could not have fired on anything — it has been dead code since it was written.

The full distribution then showed a bar is workable:

```
66 pairs across 12 entries. Top 12 by similarity:

0.500 SAME BEHAVIOUR  refreshing-a-stored-answer / what-happens-when-a-stored-answer
0.400 SAME BEHAVIOUR  answering-a-question       / what-happens-when-no-stored-answer
0.310                 answering-a-question       / choosing-between-a-saved-answer
0.273                 behaviour-when-no-codebase / what-the-bot-does-when-unreachable
...
known duplicates : 0.500, 0.400
highest non-dupe : 0.310
non-dupe mean    : 0.082
```

The two real duplicates are the top two of all sixty-six. Everything else tops out at 0.310 and averages 0.082. The bar moved to 0.35, which sits in that gap.

### What didn't work

The original calibration, and the way it went wrong is worth naming precisely. Iteration 12 wrote two sentences *designed to resemble* a re-derivation and measured 0.636. Actual re-derivations score 0.400 and 0.500.

My imitation of the engine's output was substantially more self-similar than the engine's output is. That is the same failure this project has now recorded four times — fake keywords in iteration 3, fixture vocabulary in iteration 4, ASCII apostrophes in iteration 6 — but this is the purest form of it: I sat down intending to imitate real output, and was wrong by a quarter of the scale.

### What I learned

The other half of the rule survives measurement, and it was worth checking rather than assuming. Merging also requires an identical content hash, and the obvious loosening — overlapping *file lists* rather than identical bytes — measures useless:

```
0.89  SAME BEHAVIOUR  answering-a-question / what-happens-when-no-stored-answer
1.00  SAME BEHAVIOUR  refreshing-a-stored  / what-happens-when-a-stored-answer
0.86  different       answering-a-question / choosing-between-a-saved-answer
0.83  different       behaviour-when-no-codebase / what-the-bot-does-when-unreachable
```

In a codebase this size every answer reads most of the same files, so file overlap barely separates a duplicate from a neighbour. The identical-hash requirement stays. Its cost — two entries derived either side of any code change never merge — is now written down as a known way for near-duplicates to accumulate, rather than being replaced by a rule that would merge things that are merely adjacent.

### What was tricky

Resisting the tidy fix. Loosening the hash requirement would have made the two real pairs merge and closed the item completely. The data says that rule would also merge behaviours that are only neighbours, which is worse than the accumulation it prevents.

### What warrants review

- **Two duplicate pairs, both about this bot.** The gap between 0.310 and 0.400 is real but narrow, and both sides of it come from one corpus.
- **Cross-session duplicates still accumulate**, and nothing cleans them up.

### Future work

None.

## Step 3: Making the number defensible

**Author:** main

### What I did

Added a test asserting that the two real duplicates outrank all sixty-four other pairs, and that the bar in use falls inside that gap. Then broke it in both directions.

### Why

A threshold in a comment is a number somebody will change. A threshold with the measurement attached is an argument.

### What didn't work

The first version of the test was useless, and I only found out by trying to break it:

```
=== confirm the new bar can fail: raise it back to 0.6 ===
   NOT CAUGHT
```

It asserted things about the similarity *values* — that duplicates outscore everything else — without ever reading the constant, which was not exported. Every claim in it was true and none of them protected anything: the bar could have been set to any number at all and the test would have passed.

Exporting the constant and asserting it sits inside the measured gap fixed it. It now fails when the bar is raised to 0.6, which is where it was, and when it is lowered to 0.2, which would start merging neighbours.

### What I learned

This is the fifth time tonight the habit of deliberately breaking a new test has caught something, and the first time it caught a test that was *entirely* decorative rather than merely incomplete. A test written from real measurements, describing real properties, correct in every assertion, and protecting nothing.

### What was tricky

Nothing, once the failure was visible.

### What warrants review

The test asserts the *gap brackets the bar*, so adding a corpus entry that scores 0.36 against something unrelated would fail it. That is the intended behaviour — it means the calibration needs redoing — but it will look like an unrelated change breaking an unrelated test.

### Future work

None.
