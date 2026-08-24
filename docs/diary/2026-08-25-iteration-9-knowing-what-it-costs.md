# Diary: Iteration 9 — knowing what it costs

This iteration set out to fix the latency that two previous diaries had blamed on the agent harness. It measured the problem, established that the hypothesis was right, established that the fix was not worth taking, and spent the iteration on what the measurement made obvious instead: the product's defining number was invisible.

## Step 1: Testing a hypothesis instead of acting on it

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Eighth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Iteration 5 observed that rewriting a follow-up takes four to six seconds, noticed that a smaller model was slower rather than faster, and recorded a hypothesis: the cost is per-call overhead in the agent harness, not inference. Iteration 8 independently observed the same four to five seconds for the near-miss judge, which does strictly less work. The recorded next step was to measure it.

Two checks, in order. First: is the obvious fix even available? Second: is the hypothesis true?

### Why

Both diaries had proposed the same remedy — use the plain Messages API for the two components that never read a codebase. Two iterations of speculation is enough; either measure it or stop repeating it.

### What worked

Checking feasibility before measuring, which turned out to be the decisive step:

```
ANTHROPIC_API_KEY not set
ant CLI not installed
no ~/.config/anthropic profile dir
```

There is no credential a plain SDK could use. The agent harness works precisely because it spawns Claude Code, which carries its own. Moving the resolver and judge to the Messages API would not be a refactor — it would change the product's deployment contract from "runs wherever Claude Code is authenticated" to "requires an API key provisioned, stored and protected". In a public repository, with a user who has been explicit about secrets, that is a real cost and not an incidental one.

Then the measurement, on the smallest unit of work the harness can perform — no tools, one turn, one word of output:

```
  3566ms  $0.0082  trivial run 1
  3125ms  $0.0017  trivial run 2
  3552ms  $0.0017  trivial run 3
```

About 3.2 seconds and a sixth of a cent. The hypothesis is confirmed: the resolver's four to six seconds and the judge's four to five are almost entirely fixed overhead.

### What didn't work

Nothing failed. The outcome is a negative result: a confirmed diagnosis whose only available treatment costs more than the disease.

### What I learned

The measurement also settled the shape of the problem, which I had been describing loosely. The overhead is *latency only* — $0.0017 a call is nothing against a $1 derivation. So the cost is a few seconds added to follow-ups and near misses, in a product where the alternative path takes sixty seconds. Framed that way it is clearly not worth an API key.

Two diaries had described this as a cost problem. It is a latency problem, and a small one.

### What was tricky

Being willing to spend the first part of an iteration proving that the planned work should not be done. The measurement was cheap and the alternative was carrying the same speculation into a third diary.

### What warrants review

**The decision not to migrate.** If a deployment already has an API key for other reasons, the trade reverses and the resolver and judge should move.

### Future work

None on this. It is measured, decided, and recorded so that a fourth iteration does not rediscover it.

## Step 2: What the measurement made obvious

**Author:** main

### What I did

Made the spending visible and bounded, which the cost figures above made conspicuous by contrast: a call to weigh a near miss reports $0.0017, and nothing anywhere reported what a derivation costs.

`Derivation` gained an optional `costUsd`, taken from what the engine actually reports rather than estimated. The core logs every read of the codebase with its reason and a running session total, and exposes `spentUsd()`. When the judge is offered candidates and rejects them all, that is logged too.

Added a cooldown on disputes. Flagging the same answer repeatedly read the whole codebase every time, which two diaries had recorded as an unbounded way for anyone to spend money. An entry re-read within the last five minutes is now left alone, and the asker is told it was just checked.

### Why

The single most important fact about this product is that a question costs about a dollar the first time and nothing afterwards. Every iteration has reasoned about that number, and none of them made it observable to anyone running the thing.

The judge-decline log is the more interesting half. Those are the cases where something looked close, was rejected, and a dollar was then spent on a question the knowledge base may already have answered. That is precisely the evidence needed to tell whether the judge's deliberate bias toward refusing is set correctly, and iteration 8 recorded wanting it.

### What worked

`costUsd` being optional. A stub engine spends nothing and should not have to invent a number, and the tests that use fakes did not need touching.

### What didn't work

A test caught a silent no-op in my own edit. The spend total came out as `1.25` where `2.5` was expected, because the refresh branch never recorded anything:

```
expected: 2.5
actual: 1.25
```

The string replacement that was supposed to insert `recordSpend('refresh', …)` had `if (refreshed) {` indented by ten spaces; the file has eight. It matched nothing, the script reported success, and refreshes went on spending money invisibly — in an iteration whose entire point was to stop that happening.

This is the second time in one night that an unasserted string replacement silently did nothing. The first, in iteration 6, dropped four tests from a file and I noticed only because the expected output was missing. Both times the fix was the same: assert that the replacement matched. I have started doing that consistently, which is why this one was caught by a test rather than shipped.

### What I learned

Writing the test for a number before wiring up the thing that produces it is what made this visible. Had I only tested "a derivation happens", the missing refresh accounting would have been invisible — it is not a behaviour, it is a number, and only asserting the number finds it.

### What was tricky

Choosing the cooldown's behaviour rather than its duration. Silently ignoring a repeat flag would be rude; re-deriving on every flag is the thing being fixed. Telling the asker plainly that the code was read very recently, and pointing out that the entry is a file a developer can correct, keeps the person informed and the spend bounded.

### What warrants review

- **The cooldown is per entry and in memory.** A restart forgets it, and it is per process, so two instances do not share it.
- **`[SPEND]` goes to stdout.** Fine for a process someone is watching, useless as an audit trail, and there is no per-thread or per-person attribution.
- **Five minutes is a guess.** Nothing measured it, and a developer iterating on a genuinely wrong entry will hit it and be told to go and edit the file.

### Future work

Attribute spend to the thread that caused it. "Who is this costing money" is the question an operator will actually ask.

## Step 3: Verifying it

**Author:** main

### What I did

Added four tests, bringing the suite to fifty-seven: that spend accumulates over a miss and a refresh but not over a stored hit, that an engine reporting no cost does not corrupt the total, that a repeated flag does not read the codebase twice, and that a zero cooldown blocks nothing. Then ran it live.

### Why

The spend total is a number the tests can assert exactly. Whether the number is *real* — as opposed to a field being copied around correctly — needed the actual engine.

### What worked

```
[SPEND] $0.6070 miss     (session $0.6070) What does the bot do when nobody has configured a codebase for it?
-> session total after a miss: $0.6070
-> session total after a stored hit: $0.6070
```

Real money, reported by the engine, and the stored hit moved nothing.

### What didn't work

Nothing failed, but the number is not what I have been claiming. Iteration 2 measured $1.1355 for one derivation and every diary since has said "roughly a dollar". This one cost $0.6070 — about half.

So the honest figure is a range of roughly $0.60 to $1.15, depending on how much of the codebase a question requires reading, and "a dollar" was one measurement repeated as though it were a constant. The README now says a range.

### What I learned

A number measured once and quoted eight times becomes an assumption without anyone deciding to assume it. Six diaries reasoned about the economics of this product using a figure from a single observation. The reasoning survives — a range of $0.60 to $1.15 against zero for a stored answer makes every argument that depended on it stronger, not weaker — but it was luck that it did.

### What was tricky

Nothing in the verification itself. The difficulty was noticing that a familiar number was worth questioning, in a run that had confirmed everything I set out to check.

### What warrants review

Both cost observations are on the same small, well-commented, self-describing codebase. A large or unfamiliar one will read more files and cost more, and nothing here bounds that beyond `DOCSEARCHER_MAX_USD`.

### Future work

Record cost per derivation in the entry itself. It would turn every seeded knowledge base into its own dataset on what questions about a given codebase actually cost.
