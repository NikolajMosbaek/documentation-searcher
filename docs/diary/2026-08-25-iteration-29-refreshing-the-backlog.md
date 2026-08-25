# Diary: Iteration 29 — refreshing the backlog

The triaged list of open concerns was assembled at iteration 21 and eight iterations happened after it. Several of them closed items on that list; one was closed *because* the list existed. It had gone stale in exactly the way it was written to prevent.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Twenty-eighth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Rewrote `/docs/review-backlog.md` against all twenty-eight diaries rather than the twenty-one it was built from.

### Why

It is the document somebody arriving at this repository reads first, and it was describing a version of the project that stopped existing several hours ago. Three of its open items had been closed, two of its statements about how retrieval works were wrong, and eight iterations' worth of new concerns were not in it at all.

There is also nothing else left that is both cheap and useful. The measurable claims have been measured, twice in some cases. What remains is either another corpus-growth experiment at rising cost, or decisions that are not mine to make.

### What worked

Extracting the new items mechanically rather than from memory. Iterations 22 to 28 added around thirty notes, and the ones I would have remembered are not the ones that matter — "every spend figure quoted in diaries before iteration 25 is an undercount" is the sort of thing that only surfaces by reading.

### What didn't work

Nothing failed, but the situation is mildly absurd and worth stating. Iteration 21 existed because concerns recorded in an append-only narrative get forgotten. It produced a document, which then sat in the same repository being appended around for eight iterations without being re-read. The fix for stale documentation was a document that went stale.

The difference is that this one is short enough to re-read and has a section that only changes when something is genuinely resolved.

### What I learned

The closed list is the most useful part, and it grew from twenty entries to twenty-three. Two of those closures happened *because* of the triage — the fail-open authentication default in iteration 21, and the merge threshold in iteration 22, which was measurable only because the triage put a flag from iteration 12 next to a corpus from iteration 19.

Reading the whole list at once has now directly caused two fixes that eight iterations of appending did not.

### What was tricky

Deciding what "open" means for an item that has been measured and found acceptable. The judge's accuracy is measured, good, and still the single point on which almost every answer depends — that is not closed, it is understood. It sits at the top of the open list with its measurement attached, rather than being filed under accepted.

### What warrants review

- **The triage is my judgement about my own work**, again.
- **The open list's first item is structural**, not a defect. Somebody may reasonably read it as neither open nor closed.

### Future work

Re-triage whenever it is next worked from. Eight iterations was too long.
