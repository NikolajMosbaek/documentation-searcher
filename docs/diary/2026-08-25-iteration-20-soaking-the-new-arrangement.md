# Diary: Iteration 20 — soaking the new arrangement

The previous iteration moved the judge onto the critical path for most questions, on the evidence of a corpus measurement. Every test that covers that path uses a fake judge. This ran the real one, got four failures, and found that none of them was a defect.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Nineteenth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Ran the soak, which had not been run since retrieval stopped deciding and started shortlisting.

### Why

The previous iteration changed the heart of how questions are answered on the strength of a measurement, and validated it with tests that substitute a fake judge for the real one. The single assertion most at risk — that asking the same thing in different words does not pay again — now depends on a model rescuing a shortlist rather than on retrieval serving directly. Nothing had tested that with a real model.

### What worked

Choosing to run it rather than reason about it. The reasoning would have been wrong in an interesting way.

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

## Step 2: Four failures, none of them a bug

**Author:** main

### What I did

Seeded the soak with the twelve-entry evaluation corpus committed in the previous iteration, and ran it. Four checks failed:

```
FAIL  and stored
FAIL  a rephrasing does not pay again  -- $0.7988
FAIL  the dispute did not duplicate the entry  -- entries=12
FAIL  the refresh did not duplicate the entry  -- entries=12
```

Then worked out why, rather than fixing anything.

### Why

The first suspicion was the worst case: the corpus contains an entry whose stored question is *exactly* the soak's question, and the run derived an answer instead of serving it. That would mean the exact-question guarantee — a promise made in iteration 3 and relied on since — was broken.

It is not. Checking directly, `find` returns that entry. What happened is that the entry was found, its fingerprint compared against a codebase that had moved on by nineteen iterations, and it was correctly judged stale, re-derived, and replaced in place. Hence `source=engine`, and hence a count of twelve rather than thirteen: nothing new was stored because an existing entry was refreshed.

Every check that failed did so because it assumes the first question is one the stored entries do not answer. I had seeded a corpus that answers it. The product did exactly the right thing at every step.

The rephrasing had the same cause. It was rescued from the shortlist, matched a stale entry, and paid to re-derive it — which is the correct behaviour for an entry whose code has changed, not a failure of the rescue.

### What worked

Testing the rescue separately, for cents, rather than inferring it from the soak:

```
if nothing is on file about my question, what do I get back?
  served by retrieval: (no)
  shortlist (5): what-happens-when-no-stored-answer-covers-a-question.md, …
  judge chose: what-happens-when-no-stored-answer-covers-a-question.md

how does it know an answer went stale?
  judge chose: refreshing-a-stored-answer-when-the-code-behind-it-has-chang.md
```

All three rephrasings rescued correctly, including the one retrieval used to get *wrong* — before the previous iteration it served the unreachable-service entry for the staleness question. The new arrangement works with a real model.

### What didn't work

My seed choice. Iteration 18 seeded with billing entries, which are unrelated to the questions the soak asks, and that is what makes the run meaningful. Seeding with the evaluation corpus — which is largely about this bot — broke the premise every subsequent check depends on.

### What I learned

A soak that quietly tests the wrong thing is the same class of failure as one that passes while proving nothing, which this project has now hit four times in different forms. Here it reported failures, which at least gets attention — but the failures pointed at the product when the fault was in how the run was set up, and half an hour could easily have gone into "fixing" correct code.

### What was tricky

Resisting the first explanation. "The exact-question guarantee is broken" was consistent with everything visible on screen, and it is a serious enough claim that it was worth ten minutes to check rather than act on. It was wrong.

### What warrants review

Nothing; the product was not changed in this step.

### Future work

None.

## Step 3: Making the soak refuse a seed it cannot test

**Author:** main

### What I did

The soak now checks its own premise before running anything. If the seeded knowledge base already answers the scenario's question, it says so and exits without spending:

```
The seeded knowledge base already answers the scenario's question.
  question: What happens when someone asks a question the bot has no stored answer for?
  answered by: answering-a-question-nothing-stored-covers.md
The soak needs a question its starting entries do not cover; nothing was checked.
```

Then re-ran with the billing entries, which do not cover it.

### Why

Every count the run asserts is relative to a first question that gets derived. Seed something that already answers it and the run measures a merge instead of a new entry and a refresh instead of a derivation — and reports four failures that say nothing about the product. Refusing costs nothing and names the problem exactly.

### What worked

The re-run, with the whole arrangement exercised for real:

```
> if nothing is on file about my question, what do I get back?
  knowledge-base  0s  $0.0000
PASS  a rephrasing does not pay again  -- $0.0000

session spend: $2.3518 across 4 entries
SOAK PASSED
```

Every check green with the real engine, the real judge and the real resolver.

The rephrasing is worth a second look: zero seconds and nothing spent, meaning no judge call was needed at all. With four entries and only one of them about the bot, the correct entry has no serious competitor, so its margin over the runner-up is enormous and retrieval serves it directly. The margin rule adapts to the size of the knowledge base without being told to — which is the property an absolute threshold could not have.

### What didn't work

Nothing failed.

### What I learned

The margin rule turns out to be doing something better than the fixed bars it replaced. On a large corpus it is cautious, because plausible competitors exist; on a small one it is decisive, because they do not. That was not the argument for it — the argument was that wrong answers beat their runner-up by 1.04x and right ones by 2.2x — but it falls out of the same property.

### What was tricky

Judging whether the re-run was worth two dollars and forty cents, having already established the rescue works for cents. It was: the cheap test covered one link, and the previous iteration changed the path every question takes. The soak is the only thing that runs all of it together.

### What warrants review

- **The premise check only tests the first question.** A seed that covers the rephrasing but not the question would still skew the run.
- **Four entries is a small corpus for the soak.** It is now known that the margin rule behaves differently at that size, so a soak passing there does not say much about a large knowledge base.

### Future work

None outstanding.
