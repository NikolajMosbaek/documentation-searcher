# Diary: Iteration 27 — the soak after the thresholds went

The previous iteration deleted the three numbers that decided whether a stored answer could be served, and made a model decide instead. That changes what happens to every question. The soak is the only thing that runs all of it together, and it had not run since.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Twenty-sixth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Ran the soak against the new arrangement, seeded, end to end.

### Why

The same reason as iteration 20, and the change is larger this time. Retrieval no longer decides anything, `find` matches only an exact repeat, and the seeding command consults a judge before paying for a derivation. Every one of those was validated by tests using a fake judge.

### What worked

Running it in the background. The soak takes eight or nine minutes and the previous iteration had already hit a ten-minute limit mid-derivation; there was no reason to discover that twice.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new.

### What was tricky

Nothing.

### What warrants review

Nothing from this step.

### Future work

None.

## Step 2: What it showed

**Author:** main

### What I did

Read the transcript rather than the exit code, which is now the habit.

### What worked

Everything passed, and the shape of the run is the thing worth recording:

```
> What happens when someone asks a question the bot has no stored answer for?
  engine  86s  $0.8696       <- nobody has asked this
> What happens when someone asks a question the bot has no stored answer for?
  knowledge-base  0s  $0.0000  <- the same words
> if nothing is on file about my question, what do I get back?
  knowledge-base  4s  $0.0000  <- different words, judged
> what happens when a free trial expires?
  knowledge-base  5s  $0.0000  <- a seeded entry, judged
```

Three prices, all visible in one session. A question nobody has asked costs about eighty seconds and most of a dollar. The same question in the same words costs nothing at all and returns in no measurable time — that is the exact-wording guarantee, and it is the only thing left that answers without asking anybody. The same question in different words costs about four seconds and a fraction of a cent.

The middle case is what the previous iteration bought. It used to be instant, and twice out of seventeen it was instant and wrong.

### What didn't work

Nothing failed.

### What I learned

The soak is now measuring something it was not designed to measure. It was built in iteration 10 to check that the mechanisms work together; what it shows most clearly now is the *cost shape* of the product, because every turn prints its price. The three numbers above are a better summary of what this thing is than anything in the PRD.

### What was tricky

Nothing.

### What warrants review

- **Four entries.** The soak's knowledge base is small, and the previous iteration established that behaviour differs with corpus size. A green soak says the mechanisms cooperate, not that the thresholds — of which there is now one, the shortlist size — are right.

### Future work

None.

## Step 3: What the refactor left behind

**Author:** main

### What I did

Went looking for dead code and stale comments from removing three constants, and put the measured costs into the README.

### Why

A refactor that deletes decisions tends to leave the machinery that fed them.

### What worked

Less than expected, which is the good outcome. The three constants are gone with no references left. `coverage` is still computed and is now read by nothing that decides — it is not dead, because reading it beside the score is how a ranking gets understood when it goes wrong, but it looked load-bearing and is not. It says so now.

One comment in the merge tests had gone quietly wrong. Written in iteration 22, it described a constructed re-wording scoring 0.64 as clearing the bar "but not by much" — true when the bar was in a gap between 0.31 and 0.40. Iteration 26 then measured real re-derivations at 0.18 to 0.89 and established there is no gap. The comment now says the example is constructed rather than typical.

### What didn't work

Nothing, though the comment is a small instance of the thing this project keeps finding: it was correct when written, invalidated by a measurement four iterations later, and nothing connected the two. The drift test cannot read prose, and this is prose inside a test.

### What I learned

The README's headline figure was a ratio between two numbers — a dollar and nothing. There are three now, because the middle case exists and costs something, and stating two of them was hiding the trade the last two iterations made.

### What was tricky

Nothing.

### What warrants review

- **Comments in tests are documentation nothing checks**, and there are now a lot of them carrying measurements.

### Future work

None outstanding.
