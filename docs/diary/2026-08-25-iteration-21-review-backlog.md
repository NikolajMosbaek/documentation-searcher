# Diary: Iteration 21 — reading twenty diaries at once

Every iteration ends by writing down what a reviewer should look at. Twenty iterations produced a hundred and eight such notes, each written in isolation and none ever read alongside the others. Reading them together closed most of them and surfaced one that should have been fixed nineteen iterations ago.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Twentieth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Extracted every *What warrants review* item from every diary, triaged them, wrote `/docs/review-backlog.md`, and fixed the most serious thing the exercise turned up.

### Why

The habit of ending each iteration with a list of concerns is only worth anything if somebody reads the lists. Nobody had. They accumulate at three to six an iteration into files nobody revisits, which is a good way to feel diligent while producing nothing actionable.

There is also a specific reason to do it now rather than build something else: whoever picks this up is going to arrive at twenty commits and twenty diaries with no idea which of the concerns inside them still stand. Sorting that is more useful to them than a twenty-second feature.

### What worked

Counting first. My estimate was about sixty items; there are a hundred and eight. That is enough that reading them in a single pass changes what you see — the same concern appears in three iterations under three descriptions, and half of them turn out to have been closed by an iteration that never knew it was closing them.

### What didn't work

Nothing failed in this step.

### What I learned

Writing a concern down is not the same as tracking it. Several items were fixed and never marked; several were restated as though new; one serious one was flagged twice and then never mentioned again.

### What was tricky

Deciding whether this counts as an iteration. It produces one document and one small code change, which looks thin next to a retrieval measurement. It is the difference between a hundred and eight scattered notes and a triaged list, which is most of the value those notes could ever have had.

### What warrants review

The triage is my judgement about my own work. Somebody else reading the same hundred and eight items would sort them differently, and would probably be right to.

### Future work

The backlog needs re-triaging whenever it is next worked from, or it becomes another artefact nobody reads.

## Step 2: The one that should not have survived

**Author:** main

### What I did

Fixed the fail-open default on unauthenticated requests.

Iteration 1 flagged it:

> `dangerouslyAllowUnauthenticatedRequests` is gated on `process.env.NODE_ENV !== 'production'`. That default fails open: anything deploying this without setting `NODE_ENV=production` accepts unauthenticated requests on `/api/messages`.

Iteration 2 restated it, noting that there was now a real engine behind it. Then nineteen iterations passed and nobody mentioned it again, including me, repeatedly, while editing the file it lives in.

It now requires `DOCSEARCHER_ALLOW_UNAUTHENTICATED=true`, and says so in the log when set.

### Why

Of the open items this is the only one with a security consequence, and it is the cheapest to fix. The endpoint answers questions about a private codebase; the failure mode is that a deployment nobody remembered to set an environment variable on will answer anybody who asks.

Inferring "is this development?" from the absence of a production marker is the wrong direction for anything named `dangerously`. Off unless asked for, rather than on unless forbidden.

### What worked

Verifying it rather than trusting the diff:

```
=== default: no flag ===
0 warnings (correct: it is off)
  unauthenticated POST -> http_status=401

=== opted in ===
[WARN] accepting unauthenticated requests because DOCSEARCHER_ALLOW_UNAUTHENTICATED is set.
  unauthenticated POST -> http_status=500
```

401 by default, where every previous run of this bot in a development shell would have accepted the request. The 500 in the opted-in case is the agent trying to deliver its reply to a `serviceUrl` that nothing is listening on, which iteration 1 established is evidence the handler ran.

The drift test from iteration 14 also did its job unprompted: removing `NODE_ENV` and adding a new setting would have left the configuration table describing one variable that is no longer read and omitting one that now is, and the test enforces both directions.

### What didn't work

Nothing failed, but the interesting part is why this survived. It was never a hard problem. It was flagged clearly, in writing, twice, in the first two hours — and then every subsequent iteration had something more interesting to do. Nineteen of them.

### What I learned

A concern recorded in a place that is only ever appended to is a concern being forgotten in slow motion. The diaries are chronological by design: they are a narrative of how the work went, and they are the wrong shape for tracking anything, because tracking requires re-reading and a narrative invites you not to.

This is close to the failure the product itself exists to prevent. A knowledge-base entry written correctly and never re-read goes quietly wrong; the bot re-checks its entries against the code on every read for exactly that reason. The diaries have no such mechanism, and neither did the concerns inside them.

### What was tricky

Nothing technically. Reading a hundred and eight notes and deciding which were still true took most of the time.

### What warrants review

- **The new setting is a string comparison against `'true'`.** Anything else, including `1` or `yes`, leaves it off. That is the safe direction and will confuse somebody.
- **Local development is now two variables** — the codebase and the flag — where it used to be one.

### Future work

None.

## Step 3: What the triage says

**Author:** main

### What I did

Sorted a hundred and eight notes into: still open and worth attention, small and cheap, decisions that are the user's to make, accepted trade-offs, and closed.

### Why

"Open" and "closed" is not enough. A third of what remains is not work at all — it is a decision somebody has to make about what this product should be, and presenting those as engineering tasks would be a category error. Another chunk is deliberate trade-offs that should stay decided rather than being rediscovered and re-argued.

### What worked

The closed table, which turned out to be the most reassuring artefact in the project. Twenty of the most serious flags were fixed during the run, and almost all by iterations that had no idea they were closing anything — the merge in iteration 12 closed a concern raised in iteration 2; the test suite in iteration 4 closed one raised twice; the drift test in iteration 14 closed one from iteration 13. Concerns raised in writing do get addressed, just not deliberately.

### What didn't work

Nothing.

### What I learned

The open list is smaller and sharper than the raw count suggests, and it is dominated by one theme. Almost everything genuinely open is about *not having measured something at realistic scale*: thresholds from twelve entries, a similarity bar from four hand-written pairs, a safety property verified against one false objection, heuristics whose accuracy nobody has measured, and a product that has never run inside the interface it is built for.

That is a coherent statement about the state of this thing, and it is not one I could have made from any single iteration.

### What was tricky

Being honest in the decisions section. Six of those are calls I made during the run that could reasonably have gone the other way, including one — reading the PRD's CLI exclusion as being about the asking interface — where a stricter reading would reject an entire iteration. Listing them as open decisions rather than settled ones is the accurate thing to do, and it invites the work being undone.

### What warrants review

The whole document is my triage of my own work, with the biases that implies. The raw material is in the diaries and somebody should disagree with some of it.

### Future work

None.
