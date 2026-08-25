# Diary: Iteration 23 — measuring two regexes that decide things

Two small regexes decide how every message is routed: whether a question leans on the conversation, and whether it disputes the last answer. Neither had ever been measured. One of them was missing more than half of what it exists to catch.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Twenty-second firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Measured `looksDependent` and `looksLikeCorrection` against labelled sets, and fixed what the measurement showed.

### Why

Measuring something never measured has now been the right call three iterations running — the cold-start bug, the inert retrieval thresholds, the merge that could not fire. These two are the last items on that list that cost nothing to check.

They also decide something consequential. Everything about how a message is handled — rewritten, disputed, or answered as a fresh question — turns on two regular expressions written in a few minutes.

### What worked

Finding independent data. Any set I write shares an author with the patterns, which is the trap this project has fallen into four times. But iteration 7's seeding proposal produced thirteen questions written by a model, explicitly "phrased the way an asker would type them into a chat", and they were still in the scratch directory. They are genuine standalone first-questions written by something other than me.

### What didn't work

Nothing failed in this step, though the limitation is real and stated: the *positive* examples — follow-ups and disputes — are mine. Only the negatives are independent.

### What I learned

Nothing new; this was following an established pattern.

### What was tricky

Nothing.

### What warrants review

Half the labelled data is mine.

### Future work

None from this step.

## Step 2: What the measurement showed

**Author:** main

### What I did

Ran both heuristics against the labelled sets.

### What worked

The measurement separated cleanly into one problem and one non-problem.

```
=== looksLikeCorrection ===
  model-written questions, none of them disputes: 13/13 (100%)
  ways of saying the last answer was wrong (mine): 8/18 (44%)
    MISSED: that doesn't sound right to me
    MISSED: I think you have that backwards
    MISSED: we changed that last sprint
    MISSED: nope
    MISSED: not quite
    MISSED: the answer is stale
    MISSED: you are mistaken about the retries
    MISSED: incorrect
    MISSED: that used to be true but not any more
```

Ten of eighteen missed. Every one is an ordinary thing a person says. The correction path built in iteration 6 — read the code again, keep the entry honest — was firing only for a narrow set of phrasings and silently treating everything else as a brand new question. Iteration 6 had noted one of these ("that doesn't sound right to me") as a known miss; there were nine more.

Widened, and re-measured: eighteen of eighteen, with the thirteen independent negatives still clean.

### What didn't work

The widening introduced a false positive, found by testing plausible questions rather than only the labelled set:

```
FLAGGED  does the answer contradict the docs?
```

A bare `contradicts?` matches an ordinary question. Narrowed to require something pointing back at the previous answer — "that contradicts", not "answer contradict" — which keeps the real dispute and releases the question.

That case was not in either labelled set. I found it by asking what a person might plausibly type that is *near* a dispute without being one, which is a category I had not built a set for.

### What I learned

The other heuristic's result looks bad and is not:

```
=== looksDependent ===
  model-written standalone questions: 4/13 (31%)
  follow-ups that lean on the conversation: 18/20 (90%)
```

Nine of thirteen genuinely standalone questions are flagged as follow-ups, because a question *about a bot* naturally says "it" — "will it ever give me file names?" reads as dependent to a regex looking for referents.

At first glance a 69% false-positive rate is a defect. It is the deliberately cheap direction, and the arithmetic supports it: a false positive costs one rewrite that returns the question unchanged, a few seconds and a fraction of a cent. A false negative costs a derivation of a question nobody can read — about a dollar — plus a knowledge-base entry to match. The bias is worth roughly twenty false positives per false negative avoided, and it is running at about two.

So it stays, and the measured rate is written down rather than quietly tolerated.

The two genuine misses were worth fixing, though, since false negatives are the expensive side: "could you expand on the third step?" and "say more about the edge cases" both clear every rule, because they open with a verb and name enough nouns to look self-contained. A pattern for asking-for-more takes it to twenty of twenty.

### What was tricky

Reading a bad-looking number correctly. The instinct on seeing 31% is to tighten the rule, which would trade cheap mistakes for expensive ones. Working out the relative cost of the two failure directions is what made it obvious the number was fine.

### What warrants review

- **The dispute patterns are now fourteen alternatives.** Each was added for a measured miss, and each is a chance for a false positive that no set covers.
- **"we changed that last sprint" is treated as a dispute.** It is a claim the code moved rather than a statement the answer is wrong, and it is a fair reading, but it is the loosest of the additions.

### Future work

None.

## Step 3: Committing the measurements

**Author:** main

### What I did

Added both labelled sets as tests — the ten previously-missed disputes, the near-dispute questions that must not be flagged, and the elaboration follow-ups — with the measurement and the reasoning written into the test file.

### Why

A regex that has been measured once is a regex that will drift. The examples that motivated each pattern belong next to it, otherwise the next person to widen it has no way to know what it was widened for.

The `looksDependent` test is the interesting one: it asserts that a standalone question mentioning "it" *is* flagged, which looks like asserting a bug. The comment explains why it is the cheap mistake and gives the arithmetic. Without that, somebody will eventually "fix" it and trade a dollar for a cent.

### What worked

One hundred and one tests pass. The new ones would have failed before this iteration, which is the only thing that makes adding them worthwhile.

### What didn't work

Nothing.

### What I learned

Writing down why a test asserts something that looks wrong is worth more than the assertion. This project has three of those now — that a small corpus offers everything to the judge, that a near miss goes unanswered, and now that a standalone question gets rewritten. All three look like defects and are decisions.

### What was tricky

Nothing.

### What warrants review

Nothing beyond what is recorded above.

### Future work

None.
