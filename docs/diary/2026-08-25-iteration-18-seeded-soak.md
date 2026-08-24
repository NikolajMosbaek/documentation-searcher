# Diary: Iteration 18 — soaking a knowledge base that is not empty

Every soak this project has run began with nothing stored. The previous iteration found a serious bug that hid in exactly that gap — a knowledge base with one entry behaves nothing like one with none. This exercised the state in between and found no new defect, but measured something worth knowing.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Seventeenth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Made the soak able to start from a knowledge base that already holds entries, and ran it seeded with this project's example billing entries while asking questions about the bot.

### Why

The previous iteration is the argument. I had said the backlog was down to marginal items; a small feature then walked straight into the most serious bug of the night, and it had hidden because no run had ever put the product in that state.

That is evidence about where to look, not a one-off. Every soak started empty because empty is the simplest state to reason about — and it is the least like a running deployment. Seeded with entries about something else entirely is both more realistic and more adversarial: it is the arrangement in which a bot that over-matches will answer the wrong question.

### What worked

Choosing entries that are unrelated on purpose. The seeded base is about subscription billing; the questions are about how the bot itself behaves. Any hit there is a false one by construction, so the check needs no judgement about whether an answer was "good enough".

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new; this was following the previous iteration's evidence.

### What was tricky

Deciding what the seeded run should additionally assert. Checking that the bot is not wrongly served is only half of it. A fix for answering too eagerly is easy to overshoot into never answering, and the previous iteration had just made retrieval stricter — so the run also asserts that a question the seeded entries *do* answer is still served, for nothing.

### What warrants review

The seeded base is three entries. A deployment that has been running for months is a different state again, and still untested.

### Future work

None from this step.

## Step 2: Building it

**Author:** main

### What I did

`DOCSEARCHER_SOAK_SEED` names a directory of entries copied into the soak's workspace before it starts. Every count the run asserts is now relative to what it started with rather than assuming zero. The scenario gained an optional `alreadyCovered` — a question the seeded entries answer — and two checks that use it.

### Why

The counts mattered more than expected. Three assertions were written as `knowledgeBase.size === 1`, which is only true starting from empty; they are now `seeded + 1`. Left alone they would have failed on every seeded run for a reason that has nothing to do with the product.

### What worked

The drift guard caught the new setting before I had thought about the README — the second consecutive iteration it has done that, and the second consecutive time it caught me rather than a deliberate break.

### What didn't work

Nothing failed.

### What I learned

Nothing new.

### What was tricky

Nothing.

### What warrants review

- **`alreadyCovered` is optional** and silently unchecked when absent, so a custom scenario that omits it loses half the value of a seeded run without being told.

### Future work

None.

## Step 3: What the run showed

**Author:** main

### What I did

Ran the soak seeded with the three billing entries, then measured what the retrieval scores actually were, rather than concluding from seventeen PASS lines that all was well.

### Why

The previous iteration's bug was found inside a run whose checks all passed. Reading the numbers is now a habit rather than a step.

### What worked

Every check passed, including both directions of the thing this iteration exists to test:

```
> What happens when someone asks a question the bot has no stored answer for?
  engine  $0.7342  entries=4
PASS  a question the stored entries do not cover is derived

> what happens when a free trial expires?
  knowledge-base  0s  $0.0000  entries=4
PASS  a question the stored entries do cover is served for nothing
```

A question about the bot was not answered from entries about billing, and the billing entries still answer their own question for nothing. Nothing duplicated, the dispute and cooldown behaved, staleness and refresh behaved. No new defect.

### What didn't work

Nothing failed, but the measurement is more interesting than the result:

```
corpus: 3 billing entries

not served score=0.93 cov=0.17  What happens when someone asks a question the bot has no stored answer for?
not served score=0.98 cov=0.20  if nothing is on file about my question, what do I get back?
SERVED     score=4.25 cov=1.00  what happens when a free trial expires?
```

Questions the entries plainly do not answer score **0.93 and 0.98** against a score bar of **1.0**. They were not stopped by the score. They were stopped by the coverage bar — how much of the question the entry accounts for — at 0.17 and 0.20 against 0.34.

So the run passed on a margin of two hundredths on one bar and a comfortable margin on the other. Iteration 4 required a match to clear both, on the reasoning that score alone rewards a long entry containing one rare word. That reasoning was right and the second bar is doing the work here almost single-handedly.

### What I learned

A passing run and a healthy margin are different things, and only one of them is visible without looking. Had the score bar been the only one, this iteration would have reported a bug of the same family as the previous one. The design decision that prevented it was made fourteen iterations earlier for a reason that was not this one.

It also sharpens what is already recorded: neither bar has been tuned against a knowledge base of any size, and the one that is holding the line here is the one with no measurement behind it at all.

### What was tricky

Stating what this run does and does not prove. It exercised a state nothing had exercised and found no defect — that is worth something. It is not evidence that the previous iteration's fix works, because at three entries the degenerate case that fix addresses barely applies; the evidence for that was the before-and-after comparison in iteration 17. Reporting a green soak as confirmation of an unrelated fix would be exactly the kind of overclaim this project keeps catching.

### What warrants review

- **Three entries is still small.** The thin margin observed here may widen or narrow at thirty and nobody knows which.
- **One seeded run, one codebase, one set of questions.**

### Future work

Tune both bars against a knowledge base of tens of entries, which is now recorded for the third time and is the clearest outstanding risk in the product.
