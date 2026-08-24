# Diary: Iteration 15 — whose question was that

The spend log said what was spent and why. It did not say who, which is the question an operator actually asks when a bill arrives.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Fourteenth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Attributed every read of the codebase to the conversation that caused it, and exposed the breakdown.

### Why

The candidates left are thin, and I said so in the previous iteration rather than dressing them up. This one has the clearest motivation of what remains: a product whose defining risk is per-question cost had a spend log that could tell you the total and nothing about its distribution. "We spent fifty dollars yesterday" is not actionable. "Two thirds of it was one conversation" is.

The other candidates — splitting the overloaded provenance enum, a seeding dry run, making the soak's questions configurable — are real but smaller, and the provenance one is already guarded by a test that renders every variant, so the bug it would prevent cannot recur silently.

### What worked

The information was already there. `ask` receives the `ThreadContext`, so the conversation id was in scope at every point money is spent; it just was not being recorded.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new.

### What was tricky

Judging whether this is worth an iteration at all. It is a log field and an accessor. What makes it worth it is that the alternative — an operator with a bill and no way to attribute it — is a real operational dead end, and the fix is small precisely because the groundwork was laid in iteration 9.

### What warrants review

Whether the loop should still be running. The product is complete, tested, documented, checked by CI, and its documentation is now self-checking. The remaining backlog is genuinely marginal.

### Future work

A seeding dry run, and making the soak's questions configurable so it can be pointed at another codebase.

## Step 2: Building it

**Author:** main

### What I did

`recordSpend` takes the conversation id and keeps a per-thread tally alongside the session total. The log line carries both:

```
[SPEND] $0.7176 miss     thread=19:a1b2c3 (thread $0.7176, session $2.2489) What happens when a trial ends?
```

`Core` gained `spendByThread()`, returning each conversation's cost and how many reads it took, most expensive first. The dispute path needed the conversation id threading through — it had been taking only the previous turn, which knows what was asked but not where.

### Why

Sorted by cost because the first question is always "what is the expensive one".

Counting reads as well as dollars because they answer different questions: a thread with one costly read is a hard question, and a thread with six is somebody arguing with the bot.

### What worked

`spendByThread` returns copies. The tally is the core's own bookkeeping, and handing out references to it would let any caller silently corrupt the numbers it is reporting. There is a test for that specifically.

### What didn't work

Nothing failed.

### What I learned

Nothing new here; the iteration was small.

### What was tricky

Noticing that the README would go stale. Its *Known limits* section said, in as many words, "Spend is logged, not attributed" — which this iteration made false. The docs-drift test added one iteration earlier does not read prose and never would have caught it.

That is worth sitting with. The previous two iterations were about exactly this failure, I built a guard against the mechanical half of it, and then immediately produced an instance of the half the guard does not cover. The guard is not useless — it catches files, settings and commands — but the thing it cannot check is the thing that keeps going wrong.

### What warrants review

- **`spendByThread()` is called by nothing but tests.** It is API without a consumer; an operator reads the log lines.
- **Everything is per process.** A restart forgets it, and two instances do not share it.
- **The conversation id is opaque but not anonymous.** It identifies a Teams conversation, and correlating it with a person is trivial for anyone with access to the tenant.

### Future work

Nothing outstanding.

## Step 3: Verifying it

**Author:** main

### What I did

Added four tests — separate threads tallied separately and sorted by cost, a conversation answered entirely from the store never appearing at all, a dispute charged to the thread it was raised in rather than the one that asked, and the breakdown being immune to mutation by its caller. Then broke the two substantive ones deliberately and watched them fail.

### Why

Because of last iteration's lesson, which is now the standing rule here: a verification never observed failing is not a verification. These four passed the moment they were written, which is also what four tests that check nothing do.

### What worked

```
--- break attribution: charge everything to one thread ---
not ok 31 - spend is attributed to the conversation that caused it
--- break the defensive copy ---
not ok 34 - the breakdown cannot be mutated by whoever reads it
```

Both caught, both restored, seventy-eight passing afterwards with a clean tree.

The parts-add-up assertion is the one worth having. Each thread's cost is tracked independently of the session total, so they could drift apart; asserting `spentUsd()` equals the sum of the breakdown catches a whole class of accounting bug that per-thread assertions alone would not.

### What didn't work

Nothing failed.

### What I learned

Testing the free case mattered more than expected. A conversation answered entirely from the knowledge base should not appear in the breakdown at all — not with a zero, but absent — because an operator scanning the list wants the threads that cost something. Asserting the empty array pins a decision that is otherwise easy to reverse by accident.

### What was tricky

Nothing. The pattern of breaking each check is now routine and takes a minute.

### What warrants review

The tests assert on cost totals from a fake engine reporting a fixed $1.25. Nothing has verified attribution against real, varying costs — though iteration 9 already established that the reported figure is real.

### Future work

None.
