# Diary: Iteration 13 — a front page that orients rather than recounts

The README had become a changelog. Twelve iterations, newest first, sixty lines of history before a reader reached the command that runs the thing. Rewriting it as orientation turned up something better than untidiness: three of its statements were false.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Twelfth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes, cheaply where possible.

### What I did

Rewrote `/README.md` around what a newcomer needs, and moved the history to where it already lived properly.

### Why

Each iteration had added a paragraph to the top of the README describing what it changed, which was the right thing to do at the time and the wrong thing to have accumulated. The result put twelve paragraphs of history above the quick start, ordered by when they happened rather than by what anyone needs first.

The diaries already hold the history, in more detail, with the failures included. The README was duplicating them badly.

There is also something fitting about it. This project exists because a codebase is hard to arrive at cold, and its own front page had stopped being possible to arrive at cold.

### What worked

Treating "what does someone arriving know nothing about" as the outline: what is this, how do I run it, how does it decide, what does an entry look like, where is everything, what does it not do. That ordering is obvious once written down and was not what was there.

### What didn't work

Nothing failed in this step.

### What I learned

Documentation written incrementally by whoever last changed something drifts toward being a log of changes, because that is what each individual edit is. Nothing about any single edit was wrong.

### What was tricky

Deciding what to cut. Much of the changelog was genuinely good writing about real decisions — the reasoning behind the second opinion, the measured latency, the deliberate refusal to seed everything. Cutting it felt like deleting the work. It is all still in the diaries, and the parts that describe the product as it *is* rather than as it *changed* were kept and rewritten in the present tense.

### What warrants review

Whether a reader wants the changelog at all. There is no CHANGELOG.md and the diaries are chronological but verbose. Someone upgrading would have nowhere concise to look.

### Future work

None.

## Step 2: Three things the README was claiming that were not true

**Author:** main

### What I did

Restructured, and in reading every line found statements that had quietly gone stale:

**"Nothing rate-limits a dispute."** Under *Deliberately not built yet*. Iteration 9 added the cooldown three iterations earlier and I updated the iteration-9 paragraph at the top of the README without removing the contradicting line at the bottom. The front page of a public repository was advertising an unbounded way to spend someone's money that no longer exists.

**"keyword lookup (a placeholder, not retrieval)"**, describing `knowledgeBase.ts` in the layout. True until iteration 4 replaced it with BM25 in its own module.

**"`ask(question, thread) -> Answer`"**. It has returned an `Exchange` since iteration 5.

All three fixed. The layout also listed files in the order they happened to be added, which put `claudeResolver.ts` after `seed.ts`; it is now grouped by what things are — entry points, core, interfaces, the Claude-backed implementations behind them, tests.

### Why

The first one matters more than the other two. A stale description of an internal type is confusing; a stale claim about a spending vulnerability is the kind of thing someone makes a decision on.

### What worked

Reading every line rather than editing around the parts I remembered. All three had survived twelve iterations of me editing the same file, because each edit went to the paragraph being added and not to the paragraphs it contradicted.

### What didn't work

Nothing failed, but the pattern is uncomfortable. Iteration 9 is the one that added the cooldown; its own README paragraph says the cooldown exists. The contradiction was forty lines below in the same file, in the same commit, and I did not look.

### What I learned

Adding a section is not the same as updating a document. Every iteration tonight appended to the README and none of them re-read it. That is exactly the failure mode this product is built to prevent in a knowledge base — an entry that was right when written and is now wrong, with nobody noticing because nobody re-reads it — and the project's own README had it.

The bot checks its entries against the code they came from on every read. Nothing checks the README against anything.

### What was tricky

Nothing technically. Noticing was the whole difficulty, and it came from doing a task that forced a complete read.

### What warrants review

- **Nothing prevents this recurring.** The next iteration that appends a paragraph will be under the same pressure to not re-read the rest.
- **The layout block is hand-maintained** and will drift the moment a file is added.

### Future work

The layout section could be generated, or checked. A test asserting that every `src/**/*.ts` appears in the README and every path in the README exists would have caught the drift, and is a few lines.

## Step 3: Verifying it

**Author:** main

### What I did

Checked the new README's factual claims rather than trusting them, having just criticised it for containing three that were false.

Compared the layout block against the filesystem in both directions, timed the test suite, and read the actual values for the cooldown default, the port, and the return type of `ask`.

### Why

A document rewritten to fix false claims is an unusually bad place to introduce new ones.

### What worked

```
in src but not documented: (none)
documented but missing on disk: (none)
npm test  0.43s total
disputeCooldownMs = 5 * 60 * 1000
const port = Number(process.env.PORT) || 3978;
ask(question: string, thread: ThreadContext): Promise<Exchange>;
```

Every claim holds. "About a second" for the suite is honest at 0.43 seconds.

### What didn't work

Nothing was wrong, but the check found an omission: `PORT` is read from the environment and was not in the configuration table. Added.

### What I learned

The two-way comparison is the useful part. Checking that documented files exist catches deletions; checking that existing files are documented catches additions, which is the direction that actually drifted here — four modules were added across the night and the layout kept up only because each iteration remembered.

### What was tricky

Nothing.

### What warrants review

The verification was a one-off script rather than a test, so it protects this moment and nothing after it.

### Future work

Turn that comparison into a test. It is the cheapest possible guard against the exact drift this iteration spent its time fixing.
