# Diary: Iteration 8 — a second opinion on near misses

Every story in the PRD was built as of the previous iteration. This one works from the findings recorded along the way rather than from the requirements, starting with the most expensive: a question that an entry really does answer, phrased in words the entry does not use, missing and costing a derivation.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Seventh firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Noted first that the character of the work has changed: the only unbuilt PRD item is real Teams registration, which needs a tenant and credentials and cannot be done unattended — nor safely, given this is a public repository. So the candidates are all recorded findings from earlier diaries. Took the one with a measured cost attached.

### Why

Iteration 4 left a specific, written-down failure and asserted it as a test:

```
✗ cancel-subscription-mid-period.md (miss)   0.27  0.25  what happens if I cancel halfway through the month?
```

An entry saying "mid-period" and a question saying "halfway through the month" share one common word. That is not a tuning error and lowering the bars would not fix it honestly — iteration 4 recorded why. It is the boundary of what word-counting can do, and the fix has to be a different kind of judgement.

The cost makes it the right one to take: roughly a dollar and a minute, every time, to re-derive an answer already sitting on disk.

### What worked

Having the failure written down as an asserted test rather than as a regret. It named the exact question, the exact scores, and the reason it was not fixed, so this iteration started with a target instead of a hunch.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new.

### What was tricky

Deciding against embeddings, which would close the gap properly. They need storage for vectors, and the constitution defers storage until a fake genuinely cannot cut it. A re-ranking pass needs no storage at all, so it has to be tried first.

### What warrants review

Whether refinement iterations are what the remaining window should be spent on at all. That is the user's call, and it is flagged rather than assumed.

### Future work

Embeddings, if a re-ranking pass proves insufficient.

## Step 2: Building it

**Author:** main

### What I did

Split the retrieval outcome into three bands rather than two. `best` still returns only what clears both bars. `candidates` returns what ranked above zero but cleared neither — the uncertain band. Anything scoring zero is in neither, because it shares no word with the question.

Added `/src/core/judge.ts` (a `CandidateJudge` interface and a do-nothing implementation) and `/src/core/claudeJudge.ts`, which is given the question and the candidate titles and short answers, and returns which one answers it, or zero for none. The core consults it only when `find` came back empty *and* the band is non-empty.

The instruction is biased on purpose:

> When in doubt choose 0 — the cost of choosing 0 wrongly is that the question gets answered properly from scratch, while the cost of choosing wrongly is that someone is given an answer to a question they did not ask.

An entry the judge rescues goes through the staleness check like any other hit. That is asserted in a test, because it would be easy to write a rescue path that quietly bypasses it.

`createCore` was about to take a fifth positional argument. It now takes `(knowledgeBase, engine, options)` with `sources`, `resolver`, and `judge` named. The forty-five existing tests are what made that safe to change mid-iteration.

### Why

Two gates, both free, keep this from becoming a tax on every question. A confident hit needs no second opinion. A question sharing nothing with anything has nothing to weigh — sending it would be paying a model to say "none of these", which is already known.

### What worked

The refactor to an options object. Five positional parameters, three of them optional and two of them interfaces, is the kind of signature that gets called wrongly; the smell had been building for three iterations and the tests made fixing it a ten-minute change rather than a risk.

### What didn't work

Nothing failed. One import ordering slip caused a single typecheck error, fixed immediately.

### What I learned

The three-band split is the useful idea, more than the judge itself. "Confident", "worth a second look", and "nothing there" are genuinely different states, and the previous code collapsed the last two into a single miss — which is why the expensive path was taken for both.

### What was tricky

Where the judge belongs. Making `KnowledgeBase.find` async would have been the smaller diff and the wrong shape: the knowledge base is files and lookup over them, and it should not become a thing that makes network calls. Exposing the band and letting the core decide keeps every model-backed component coordinated in one place.

### What warrants review

- **The judge sees only titles and short answers**, not the full entry. Cheaper, and enough in every case tried — but an entry whose relevance lives in its edge cases could be declined on an incomplete reading.
- **Nothing caps how often the judge runs.** It is cheap, but it is a model call on every near-miss question.

### Future work

If the judge proves reliable, the lexical bars could be raised rather than lowered — letting retrieval be even more reluctant and leaning on the second opinion — which would reduce wrong hits without costing more misses.

## Step 3: Verifying it

**Author:** main

### What I did

Added eight tests, bringing the suite to fifty-three: two for the band itself, six for the core's behaviour around the judge, including the two gates and the staleness check on a rescued entry. Then ran the real judge against the three hand-written entries with five questions.

### Why

The hermetic tests prove the wiring and the gating with a stub judge. Whether a model actually makes the right call on a real near miss is the entire question, and only a live run answers it.

### What worked

The case iteration 4 recorded as a known miss is now rescued:

```
ok     judged           cancel-subscription-mid-period.md  4909ms  what happens if I cancel halfway through the month?
WRONG  judged           (miss)                             4253ms  if someone quits partway through a billing cycle, are they charged again?
ok     judged           cancel-subscription-mid-period.md  5239ms  does the money come back if I stop paying midway?
ok     nothing to weigh (miss)                             0ms     how do I change my billing address?
ok     nothing to weigh (miss)                             0ms     can I pause my account for a month?
```

Both gates behaved. The two unrelated questions cost nothing at all — no call, 0ms — because nothing ranked. All three rephrasings had missed lexically, so before this iteration each would have cost a derivation.

### What didn't work

One of five went the wrong way, and it is worth being precise about which kind of wrong.

"If someone quits partway through a billing cycle, are they charged again?" was declined. The entry answers it — it says no renewal charge is attempted at the period end — so this is a false negative. It is also exactly the direction the prompt asks for: told to choose nothing when in doubt, the model chose nothing. The cost is a derivation that did not need to happen, which is what would have happened anyway before this iteration. Nobody is given a wrong answer.

So the honest summary is two rescues out of three near misses, with one conservative refusal — not three out of three.

### What I learned

The judge costs four to five seconds, matching the resolver's four to six from iteration 5 despite doing far less work — no codebase, no tools, a handful of lines of input. That is a second independent observation supporting the hypothesis recorded there: the latency is per-call overhead in the agent harness, not inference. Two components now pay several seconds for a small text decision.

### What was tricky

Judging my own result. "Four out of five" flatters it; "two of the three cases that mattered" is what happened, and the fifth-case failure is a design choice working as specified rather than a defect. Reporting a conservative false negative as a success would misrepresent both the number and the tuning.

### What warrants review

- **Five questions against three entries.** The two gates are structural and tested; the judge's accuracy is not measured by this, it is illustrated.
- **A false negative is invisible in production.** It looks exactly like a question the knowledge base does not cover, and the only trace is a derivation that need not have happened.

### Future work

Log when the judge declines a non-empty band. Those are the cases where a dollar was spent on something possibly already known, and they are the evaluation set for whether the bias is set correctly.
