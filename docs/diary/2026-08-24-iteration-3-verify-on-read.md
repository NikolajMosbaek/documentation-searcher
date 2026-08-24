# Diary: Iteration 3 — verify on read

Iteration 2 gave the bot the ability to write answers into the knowledge base. This iteration gives it the obligation to check them. The PRD's mechanism has three parts — consult the documentation layer first, verify a stored entry against the code before answering from it, and fill a gap by reading the codebase — and only the first and third existed.

It also fixed a defect in iteration 2 that a live run exposed and that iteration 2's own tests could not have caught: an entry could be written that the question which paid for it would never find again.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Second firing of the same self-paced loop. Run `suggest-next-iteration` against the current state of the project, take the recommended option, build it, commit and push.

**Inferred intent:** Cumulative overnight progress, one reviewable iteration at a time.

### What I did

Read `/PRD.md` and `/CONSTITUTION.md` again against the code as it now stands, and weighed three candidates: verify-on-read staleness, real retrieval in place of keyword matching, and follow-ups using thread context. Recommended and built the first.

This reversed the prediction I recorded at the end of iteration 2, which was that retrieval would come next on the strength of its measured cost argument.

### Why

The reversal came from re-reading the PRD's own reasoning rather than my note. The PRD deliberately strips code references out of answers, and records that decision as a *deprioritisation of verifiability*: "answers carry no code references for the asker to check against." That means the asker structurally cannot tell a current answer from a rotted one. Whatever guarantees freshness has to be the system, because nothing else can.

Iteration 2 made that urgent rather than theoretical. Before it, the knowledge base was three hand-written files a developer owned. After it, the bot writes entries itself and serves them to everyone who asks next — so without a staleness check, iteration 2 quietly manufactures answers that rot silently. Retrieval makes a working thing better; verify-on-read stops a wrong thing happening.

There was also a practical dependency: `derived-from` was recorded in iteration 2 specifically for this, and I flagged it then as dead weight if verify-on-read were ever dropped. Building it now settles that.

### What worked

Letting the PRD arbitrate rather than my own note from four hours earlier. The cost argument for retrieval is real and still stands, but "this is expensive" lost to "this is wrong" once both were stated plainly.

### What didn't work

Nothing failed in this step.

### What I learned

A recorded prediction about what to build next is worth exactly as much as the reasoning attached to it, and less than a fresh read of the requirements. Iteration 2's note was written while the cost of a derivation was the most recent surprise, and it over-weighted that.

### What was tricky

Nothing yet; the difficulty was all in the build.

### What warrants review

The judgement that staleness outranks retrieval. If in practice askers rarely repeat a question in the same words but the code changes slowly, the ordering was wrong.

### Future work

Retrieval remains the next obvious iteration, now with the findability fix below as a partial down-payment.

## Step 2: Building verify-on-read

**Author:** main

### Prompt Context

**Verbatim prompt:** (continuation of the same `/loop` instruction)
**Interpretation:** Build the chosen iteration.
**Inferred intent:** Complete the PRD's mechanism.

### What I did

Added `/src/core/sourceIndex.ts`: a content hash over the files an answer came from, sorted and de-duplicated so the same set always hashes the same. `Derivation` and `Entry` gained a `fingerprint`, written into entry frontmatter alongside `derived-from`. `KnowledgeBase` gained `replace`, which rewrites an entry in the same file. `createCore` gained an optional `SourceIndex`, and `ask` now checks a hit for staleness before serving it.

A content hash rather than a modification time, because entries are committed and checked out on machines that never saw the original write, where mtimes say nothing. Reading a handful of files per question is cheap next to a dollar-a-time derivation.

Three cases needed deciding rather than coding:

**A hand-written entry is never stale.** It carries no fingerprint and no `derived-from`, so there is nothing to compare. A developer wrote it deliberately and owns it, and re-deriving over the top of a human correction would be the opposite of what the PRD asks for.

**A deleted source file must change the fingerprint.** `readContents` returns a distinct marker for a file it cannot read, so deleting the code an entry describes makes that entry stale rather than leaving it looking fresh.

**A path that escapes the codebase is never read.** `derived-from` values are produced by the model and then used as arguments to a file read. Anything resolving outside the codebase root is treated as absent. This is the second place in the product where model output is treated as untrusted input — the first being `settingSources: []` in iteration 2 — and both exist because the analysed codebase is not necessarily friendly.

The hardest call was what to do when an entry is stale and re-derivation fails. Serving the stored answer breaks the PRD's promise; withholding it turns a budget blip or an outage into a knowledge base that answers nothing. The PRD's wording decided it: the promise is that nobody is handed a *silently* outdated answer. So it is handed over, with `source: 'stale'` and a one-line notice from `formatAnswer` saying the code has changed and the answer could not be re-checked.

### Why

Everything above follows from the PRD's "Verify on read" decision plus the constitution's "no database": the check has to be recomputable from files alone, on read, with no hooks or scheduled rebuilds.

### What worked

The seam from iteration 2 absorbed this cleanly. Because `Derivation` already carried `derivedFrom`, and the engine already knew the codebase path, adding the fingerprint was a field on a type the compiler then chased through every construction site:

```
src/core/claudeEngine.ts(166,3): error TS2741: Property 'fingerprint' is missing in type
'{ answer: Answer; title: string; keywords: string[]; derivedFrom: string[]; }'
but required in type 'Derivation'.
```

That was the only typecheck failure in the whole step, and it pointed exactly at the one place that needed to compute it.

### What didn't work

Nothing failed in the build itself. The failure came in verification, below.

### What I learned

Adding `'stale'` to `Answer['source']` cost nothing because iteration 2 had already replaced `Turn`'s hand-copied union with `Answer['source']`. Fixing that duplication at the root rather than widening the copy paid off one iteration later — a third state would otherwise have desynchronised the same two places again.

### What was tricky

Deciding whether the staleness notice belongs in `formatAnswer` at all. The PRD fixes the answer shape at short answer, then behaviour, then edge cases, and the constitution puts rendering in the core so no adapter can drift from it. A caveat line is not part of the answer — it is a statement *about* the answer — so putting it in the formatter is a small widening of that contract. It is in the core rather than the adapter, which is the part the constitution actually cares about, but it is a judgement call.

### What warrants review

- **`/src/core/answer.ts`** — the staleness notice prepended by `formatAnswer`. If the answer shape is meant to be inviolable, this belongs somewhere else, and the alternative is to withhold the answer entirely.
- **`/src/core/sourceIndex.ts`** — the fingerprint is truncated to 16 hex characters. Collisions are not a security property here, only an accidental-staleness one, but the truncation is a choice.
- **Cost of a false positive.** Any change to a derived-from file invalidates the entry, including a comment or a formatting pass. Since re-derivation costs about a dollar, a repository-wide reformat would invalidate and re-derive every entry that touched a reformatted file, at real expense.

### Future work

Nothing distinguishes "this file changed in a way that matters" from "this file changed." A fingerprint over something more semantic than raw bytes would cut the false-positive cost, at the price of being much harder to be correct about.

## Step 3: Verification, and the bug it found

**Author:** main

### Prompt Context

**Verbatim prompt:** (continuation of the same `/loop` instruction)
**Interpretation:** Prove the iteration works.
**Inferred intent:** Same as the previous two iterations — a passing typecheck is not evidence.

### What I did

Wrote twenty-five behavioural checks for the fingerprint, for verify-on-read, and for the escape guard, and re-ran iteration 2's twenty as a regression suite. Then ran the real engine live against a copy of the app's own source, so that modifying a file to trigger staleness was safe.

### Why

The staleness path has three branches — fresh, stale-and-refreshed, stale-and-unrefreshable — and only exercising each proves any of them.

### What worked

The fingerprint behaved as intended under every case worth checking: stable across calls, indifferent to the order paths arrive in, changed by an edit, returned to its old value when the edit is undone, changed by a deletion, and unmoved when a path climbing out of the codebase is pointed at a file that then changes — which is the assertion that the escape guard actually prevents the read rather than merely resolving oddly.

The live run confirmed the real engine records a real fingerprint, that it matches the working tree it was derived against, and that editing a file the answer came from makes it stale.

The derived answer is worth recording as evidence in itself. Asked *"What does the bot do when it cannot reach the service that reads the code?"*, it independently described the staleness warning, the fact that hand-written entries are never re-checked, and the fact that without a configured codebase staleness cannot be detected at all — all behaviour written minutes earlier, all correct, and all in product language.

### What didn't work

**The live run found a real bug, and it is the most important thing in this diary.** The first live attempt failed at a line I had added almost as an afterthought:

```
first ask: source=engine, 55s
FAIL  the entry was not stored
```

The message was wrong — the entry *was* stored. What failed was `kb.find(Q)` immediately afterwards: the entry had just been written for that exact question, and the knowledge base could not find it.

The cause is that `findEntry` matches an entry's keywords as substrings of the question, and the keywords are chosen by the model to describe *the behaviour*, while the question is the asker's words for *the question*. For the question above the model produced keywords like `degradation` and `outage`, which appear nowhere in it. So the entry was invisible to the question that paid for it.

This breaks the PRD's user story 6 — "a question that has been answered before to come back instantly" — outright, and it is silent: the asker gets a correct answer both times and simply pays twice. It also made this iteration's work largely unreachable, because staleness is only ever checked on a hit.

Iteration 2 could not have caught it. Its live run happened to ask *"how do gift cards work?"* against an entry keyworded `gift card`, and its hermetic tests used a fake engine whose keywords I had written myself — so both sides of the test agreed on vocabulary in a way that the real model does not. The bug lived exactly in the gap between a fake I authored and a model I did not.

The fix is narrow and does not pre-empt the retrieval iteration: an entry now records the `question` that produced it, and `findEntry` checks a normalised match on that before falling back to keyword scoring. That converts "the same question hits again" from a hope into a guarantee, while leaving "the same question asked differently" as the open problem retrieval is for.

**A second, smaller failure: a shell heredoc silently ate a test.** Adding the regression test through an unquoted heredoc meant the shell processed the backslashes in the Python source before Python saw them, so the search string contained a real newline where the target file contained `\n`. The replacement matched nothing, the script printed its success message anyway, and the four new checks simply did not appear in the output. I had not asserted on the replacement. Re-run with a quoted heredoc and the value passed through the environment, plus an `assert`, and they appeared.

### What I learned

**A fake you wrote and a model you did not will agree with each other far more than either agrees with reality.** Every hermetic test in iteration 2 passed, and they were not wrong — they tested that a derivation gets stored and found. They could not test that a *real* derivation gets found, because the fixture and the assertion were written by the same hand in the same vocabulary. The only thing that could find this was running the real engine end to end and checking the result rather than the exit code.

**A test that prints success while replacing nothing is the same failure iteration 1 recorded**, in different clothing. There the wait loop did not wait; here the edit did not edit. Both produced a clean run that proved nothing. The general form is that an unasserted step in a verification chain is not part of the verification.

### What was tricky

Distinguishing the bug from a design decision. "Entry stored, not findable" looks superficially like keyword matching being weak, which is a known and deliberately deferred limitation. What makes it a bug rather than the known limitation is the specific case: the exact question that created the entry. Deciding to fix that narrow guarantee, rather than either shrugging at it or pulling the whole retrieval iteration forward, was the call that took the most thought.

### What warrants review

- **`/src/core/knowledgeBase.ts`** — `findEntry` now has two mechanisms: an exact-question guarantee and keyword scoring. The exact-question pass scans every entry linearly on every question, which is fine at three entries and not at three thousand.
- **The question is stored verbatim in frontmatter.** It is a user's words, written into a file in a public repository. Nothing sensitive can reach it today, since questions come from the test harness, but once real askers are on the other end that is a channel from a chat message into a committed file.
- **The forty-two checks across both suites still live in the scratchpad**, and there is still no `npm test`. This is the second iteration to end with that note, and the suites are now large enough that leaving them outside the repository is the biggest single risk to the next iteration.

### Future work

A `npm test` target, now genuinely overdue. Real retrieval, still the next iteration and now with a sharper argument: the exact-question guarantee only covers a repeat asker who phrases it identically, which is the minority case.
