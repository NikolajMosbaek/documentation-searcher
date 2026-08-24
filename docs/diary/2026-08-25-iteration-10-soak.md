# Diary: Iteration 10 — exercising the whole thing at once

Every live check so far has driven one mechanism at a time. Every integration bug found tonight — an entry that could not be found by the question that created it, an entry stored under the question the engine echoed rather than the one the core asked, a refresh that spent money without recording it — lived in the seams between them. This iteration ran the whole product as one realistic session, and found another.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Ninth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Rather than add another mechanism, exercised the nine already built, together, against a real codebase — then fixed what that found.

### Why

The evidence was in my own diaries. Three real bugs tonight, all in the seams, none of them findable by the tests covering the parts. Meanwhile the hermetic suite had grown to fifty-seven tests and every one of them uses a fake for anything that costs money — which is right for a suite that must run in a second, and precisely why it cannot see an interaction.

Adding a tenth mechanism to nine that had never been run together seemed a worse use of the remaining window than finding out whether the nine actually work.

### What worked

Framing it as one session rather than a matrix of cases. A cold question, the same question again, a rephrasing, a follow-up, a dispute with a false claim, a repeat dispute, a source file edited underneath it, then the same question again. That is a plausible half hour for one person, and it happens to touch retrieval, the judge, the resolver, correction, the cooldown, staleness, refresh, and the spend ledger in the order a real user would.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new — this was acting on evidence already recorded rather than discovering it.

### What was tricky

Justifying an iteration that adds no capability. The output is one script and one bug fix, which looks thin next to "guided seeding" or "verify on read". It found a user-visible defect that fifty-seven tests did not, which is the argument.

### What warrants review

Whether the remaining window is better spent on more mechanisms than on exercising the ones that exist. This iteration bets on the latter.

### Future work

None; the soak is now a command that can be re-run.

## Step 2: What it found

**Author:** main

### What I did

Ran the session. All fifteen checks passed. Then read the output rather than the checks, and noticed that the repeat dispute had come back with `source=stale`.

Rendering that answer as an asker would see it:

```
_The code behind this answer has changed since it was written, and it could not be
checked again just now. Treat it as possibly out of date._

**Short answer**
I read the code for this one very recently, so I have not read it again. If it still
looks wrong, the entry is a file in the repository and a developer can correct it
directly.
```

Two sentences that contradict each other. The warning says the code changed and could not be checked; the answer says it was read moments ago. Both are shown to the person who just flagged something as wrong — the moment they are least inclined to trust the bot.

The cause is mine, from the previous iteration. Writing `recentlyRecheckedAnswer` I needed a provenance for it and did not want to grow the enum for what felt like a message rather than a state, so I reused `'stale'`. `formatAnswer` attaches a specific, user-facing warning to `'stale'`, and it silently attached it to this.

Fixed by giving it its own value, `'rechecked'`, which nothing else means anything by.

### Why

A provenance enum is not a convenient place to park a value. Every member of it is something the formatter is entitled to render differently, and borrowing one inherits whatever meaning it already had.

### What worked

Reading the transcript rather than the checks. All fifteen said PASS. The bug is visible only in output no assertion looked at, and I found it by asking why one line said `stale` when nothing was stale.

### What didn't work

The unit test written for this exact message, in the previous iteration, passed throughout:

```ts
assert.match(again.answer.shortAnswer, /very recently/);
```

It asserts the sentence and never renders the answer. The sentence was always right; the thing wrapped around it was wrong. A test that checks a field of an object cannot see what the object turns into.

### What I learned

The tests were shaped by what was easy to assert. `shortAnswer` is a string on a struct, so that is what got asserted; `formatAnswer` produces the thing a person actually reads, and almost nothing tested it. Sixty-two tests in, the function whose entire job is what the user sees had the thinnest coverage in the project.

### What was tricky

Recognising a bug inside a passing run. Fifteen PASS lines and a plausible answer is exactly what success looks like, and "why does this say stale" is a question one has to choose to ask.

### What warrants review

- **`Answer['source']` now has six members.** It is doing two jobs: recording where an answer came from, and selecting a notice. If it grows again those should probably separate.
- **The other five provenances are now rendered in a test, but only for a fixed body.** An answer with no behaviour steps and no edge cases renders differently, and only the miss case covers that.

### Future work

None outstanding on this.

## Step 3: Making the soak repeatable

**Author:** main

### What I did

Added five rendering tests — every provenance renders its answer, only a genuinely stale one is described as out of date, and the three constructed answers say what they mean — bringing the suite to sixty-two. Then moved the soak out of scratch and into the repository as `/src/soak.ts`, behind `npm run soak`, and ran the committed version.

### Why

The scratch soak found a bug and would then have vanished with the session. Its value is in being run again after the next change to any of the nine mechanisms it crosses.

It is deliberately not part of `npm test`. It reads a real codebase several times, costs two to three dollars, and takes a few minutes; a suite that expensive stops being run.

### What worked

Running the committed version rather than trusting that it matched the scratch one:

```
PASS  a dispute re-reads the code  -- corrected
PASS  a false claim is not adopted
  rechecked  0s  $0.0000  entries=1
PASS  a repeat dispute does not pay again  -- $0.0000
PASS  and it does not claim the code has changed  -- **Short answer**
PASS  moved code triggers a paid refresh  -- $0.7364

session spend: $2.1491 across 1 entries
SOAK PASSED
```

The repeat dispute now reports `rechecked`, and the check on the rendered first line confirms the contradiction is gone — the answer opens with **Short answer** rather than a warning.

The committed version also differs from the scratch one in the part most likely to break: it copies the codebase itself, into a temporary workspace, excluding `node_modules`. Committing that unrun would have been the exact failure this project's diaries keep recording.

### What didn't work

Nothing failed, though the first draft of the committed script was sloppy in a way the typechecker was happy with: it used `require` inside an ES module with a stray lint suppression, and carried a `void readFileSync` left over from an import that was no longer needed. It typechecked and would have run. Cleaned up to plain imports before committing.

### What I learned

The soak's real output is the transcript, not the exit code. Its checks are worth having so a regression fails loudly, but the bug this iteration fixed was found by reading, and the script is written to print what happened at every turn for that reason.

### What was tricky

Deciding to spend another two dollars re-running a thing I had just run. The committed script is a different script — different setup, different paths, its own copying — and shipping an unverified verification tool would be worse than not shipping one.

### What warrants review

- **The soak leaves its workspace behind** for inspection, under the system temp directory. They accumulate.
- **Its questions are about this bot specifically.** Pointed at another codebase the questions will not match it, most turns will miss, and the checks will fail for reasons that are not defects.
- **Fifteen checks, one session, one codebase.** It is a smoke test of the whole, not a suite.

### Future work

Take the soak's questions from the environment so it can be pointed at any codebase, rather than hard-coding questions about this one.
