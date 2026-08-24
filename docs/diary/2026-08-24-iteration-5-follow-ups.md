# Diary: Iteration 5 — follow-up questions

The `ThreadContext` seam has existed since iteration 1 and `ask` has opened with `void thread` ever since. This iteration used it: a question that leans on the conversation is now rewritten into one that stands on its own before anything else sees it.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Fourth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Cumulative overnight progress, one reviewable iteration at a time.

### What I did

Weighed the three PRD stories still unbuilt — follow-ups (5), in-thread correction (10), and guided seeding (11) — and took follow-ups.

### Why

The same argument that decided iterations 3 and 4, and it is becoming the reliable one: **iteration 2's write-back turns a missing feature into an active harm.**

Before the bot wrote entries, an unresolved follow-up was a bad answer to one person. After it, "and if they have no card?" is treated as a standalone question, derived at about a dollar, and then *stored* — as an entry titled something like "Behaviour when no card is present", with keywords to match, sitting permanently in a knowledge base where it means nothing to anyone who was not in that thread. The absence of conversation context stopped being a UX gap and became a data-quality problem.

The product is also described in its own PRD as a way to "have a conversation with a codebase". Without this it is a series of unrelated lookups, which is the exact phrasing user story 5 uses to describe what it does not want.

### What worked

Having a reusable test for which iteration to pick. Three times running, the question "what did the write-back turn from cosmetic into harmful?" has selected the right next thing faster than ranking features by appeal.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new; this was applying a rule that already existed.

### What was tricky

Nothing.

### What warrants review

Guided seeding is now the oldest unbuilt story and has been passed over three times.

### Future work

In-thread correction and guided seeding.

## Step 2: Building it

**Author:** main

### What I did

Added `/src/core/followUp.ts` — a `FollowUpResolver` interface, a do-nothing implementation, and `looksDependent`, a free heuristic for whether a question needs the conversation to make sense. Added `/src/core/claudeResolver.ts`, which rewrites a dependent question using the earlier turns. `Turn` gained a `resolved` field. `Core.ask` now returns an `Exchange` — the answer plus the question as it was understood.

Resolution is gated twice, and both gates are free. The first question in a thread is never rewritten, because there is nothing to lean on. A question that reads as self-contained is never rewritten either. Only what survives both costs a call.

`looksDependent` is deliberately biased towards saying yes: a false positive costs one cheap rewrite that returns the question unchanged, while a false negative costs a derivation of a question nobody can read plus a bad entry to go with it.

The resolver gets no tools at all — `tools: []` — because it reads the conversation and must never read the codebase. It chains off each turn's *resolved* form rather than the raw text, so a run of follow-ups does not decay one reference at a time.

### Why

The constitution's "fake it until a fake cannot cut it" applies cleanly. `looksDependent` is a fake for understanding, and `noFollowUpResolver` is a fake for the whole feature; the model-backed resolver sits behind the same interface, exactly as the analysis engine does.

### What worked

The `Exchange` return type. The adapter records what was typed *and* what it was taken to mean, which is the honest record of the turn and is what makes the chaining work.

### What didn't work

One test failed, and it was not the test's fault:

```
not ok 7 - a follow-up is resolved before anything else sees it
  + actual   - expected
  + 'how do gift cards work?'
  - 'What happens to a gift card balance when the account closes?'
```

The entry had been stored under the wrong question. The core resolved the follow-up correctly and derived against the resolved form, but then stored the `Derivation` exactly as the engine returned it — and `Derivation.question` is set by the engine, echoing back the question it was handed.

That echo is a place for drift, and the core is the component that actually knows what it asked. Fixed by having the core overwrite the field on the way in: `knowledgeBase.add({ ...derived, question })`.

Fixing that surfaced a second problem I had not been looking for. The refresh path had the same shape, but the right answer there is the opposite: an entry created by question Q1 can be refreshed by a *different* question Q2 that retrieval matched to it, and overwriting the stored question with Q2 would silently revoke Q1's findability guarantee from iteration 3. So the refresh keeps the original: `{ ...refreshed, question: known.question || question }`.

### What I learned

A failing test whose expectation is right is worth more than a passing one. This test was written to check that resolution reaches the engine; it caught something else entirely — an ownership question about which component decides what a stored entry's question is — and the refresh-path bug that followed would not have shown up until an entry was refreshed by a rephrasing, which no test then covered.

### What was tricky

Changing `Core.ask` to return an `Exchange`. The constitution sketches the core as `ask(question, threadContext) -> answer`, and this widens it. The word it uses is "roughly", and the alternative — having the core own the thread store so it can record the resolved question itself — would pull conversation state into the core to preserve the shape of a signature. Widening the return seemed the smaller deviation, but it is a deviation.

### What warrants review

- **`/src/core/index.ts`** — `Core.ask` returning `Exchange` rather than `Answer`, against the constitution's sketch.
- **`looksDependent`** — a regex and a word count standing in for understanding. Its false negatives are the expensive direction, and nothing measures its accuracy.
- **The resolver sees only earlier questions, never earlier answers.** "Why is that?" refers to an answer, not a question, and cannot be resolved from what it is given.

### Future work

If `looksDependent` proves unreliable, the honest fix is to resolve every mid-thread question and accept the cost, rather than making the regex cleverer.

## Step 3: Verifying it

**Author:** main

### What I did

Added nine tests — four for the heuristic and the do-nothing resolver, five for the core's behaviour around resolution — bringing the committed suite to thirty-three. Then ran a real three-question conversation against the real engine and the real resolver.

### Why

The heuristic and the wiring are testable hermetically. Whether a *model* actually produces a usable standalone question from a real fragment is not, and that is the part the feature lives or dies on.

### What worked

The live conversation did what it was supposed to:

```
asked    : What happens when a stored answer is out of date?
dependent: false
resolved : (unchanged)
answer   : source=engine, 65s, PAID for a derivation

asked    : and how does it know?
dependent: true
resolved : And how does it know when a stored answer is out of date?
answer   : source=knowledge-base, 4s, free

asked    : what if the file was deleted instead?
dependent: true
resolved : What if the file was deleted instead — how does it know a stored answer is out of date then?
answer   : source=knowledge-base, 6s, free

total derivations: 1
```

One derivation instead of three. The third question is the interesting one: its resolution carries context that was never in any *typed* question, only in the resolved form of the second. The chaining works.

### What didn't work

Nothing failed, but measuring rather than assuming changed a default I was about to set wrongly.

Resolution adds four to six seconds to every follow-up, which is most of what an asker waits for when the answer is already stored. My assumption was that a smaller model would fix it, and `DOCSEARCHER_RESOLVER_MODEL` exists so a deployment can choose. Before recommending it, I measured:

```
=== claude-opus-5 ===
  4796ms  And how does it know when a stored answer is out of date?
  6352ms  What if the file was deleted instead — how does it know a stored answer is out of date in that case?
  4575ms  Is how it knows when a stored answer is out of date the same for hand-written stored answers?

=== claude-haiku-4-5 ===
  9452ms  How does it know when a stored answer is out of date?
  8463ms  What if the file containing the stored answer was deleted instead of being out of date?
 14701ms  Is the process of detecting and handling out-of-date answers the same for hand-written ones?
```

The smaller model was **slower**, roughly twice as slow, and the second rewrite is wrong in a way that matters: it reads "the file was deleted" as the file *containing* the stored answer, when the entry is about the files an answer was *derived from*. A wrong resolution is worse than no resolution, because it sends a confidently wrong question to a dollar-a-time engine.

So the default stays on the larger model, and the recommendation I was about to write into the README would have made the product both slower and less accurate.

### What I learned

A smaller model not being faster is evidence that inference is not the bottleneck. The Agent SDK spawns a CLI subprocess per call, and several seconds of fixed overhead per call would explain both numbers. I have not measured that directly, so it stays a hypothesis — but if it holds, the fix is not a different model, it is not using an agent harness for a text rewrite at all. A plain Messages API call has no codebase to read and no tools to set up.

### What was tricky

Judging what the live run actually proves. All three questions hit the same entry, and at that moment the knowledge base contained exactly one entry — so anything matching at all would hit it. The run demonstrates that resolution produces something *matchable* and that the chaining works. It does not demonstrate that retrieval picks correctly among alternatives, because there were none.

### What warrants review

- **The live conversation ran against a one-entry knowledge base.** Read it as a demonstration of resolution, not of retrieval precision.
- **Four to six seconds on every follow-up**, even when the answer is already stored and free. That is a product-visible cost introduced by this iteration and it is not hidden anywhere.

### Future work

Time the resolver against a plain Messages API call to confirm or kill the subprocess-overhead hypothesis. If it holds, the resolver is the wrong shape and should not be built on the agent harness.
