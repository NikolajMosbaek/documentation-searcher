# Diary: Iteration 7 — guided seeding

The last substantial story in the PRD, and the one that had been passed over four times. `npm run seed` now reads a codebase and proposes what is worth documenting first; a developer ticks what they want; only then is anything written.

## Step 1: Choosing the iteration, and a conflict in the PRD

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Sixth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Cumulative overnight progress, one reviewable iteration at a time.

### What I did

Built guided seeding. Iteration 6's diary recorded that it had been deferred four times and that the next iteration should either build it or write down why it was not worth building, so the choice was made before this one started.

Before building, resolved an apparent conflict in the PRD. Guided seeding needs a developer to choose from a proposal, which needs a developer-facing surface — and the PRD lists "a CLI front end" as explicitly out of scope.

### Why

The exclusion does not apply, and the PRD's own wording is what settles it:

> **A CLI front end.** Teams is the only interface. A CLI was considered and deliberately dropped — it would only serve people who already have a checkout and a terminal, which is precisely the developers this product is trying to take out of the loop.

The reason given is about *who a CLI would serve*: it rejects a CLI for asking questions, because asking is what non-developers need and a terminal excludes them. Seeding is the opposite case. Its user story opens "As a developer setting this up on an existing codebase" — someone who by definition has a checkout and a terminal. Putting the choose-and-review step in Teams would be worse, not better: it would ask a product owner to approve which parts of a codebase get documented.

So the exclusion is read as scoping the *asking* interface, not banning developer tooling. That is an interpretation of an explicit out-of-scope item, which is exactly the sort of thing that should be argued in writing rather than assumed.

### What worked

Reading the exclusion's rationale rather than its heading. "A CLI front end" and "a setup command" are the same technology and different products; the PRD's stated reason distinguishes them cleanly.

### What didn't work

Nothing failed in this step.

### What I learned

Four deferrals in a row were each individually defensible and collectively a pattern. Writing "either build it next time or say why not" into iteration 6's diary is what stopped a fifth.

### What was tricky

Being honest that this is an interpretation. A stricter reading of "Teams is the only interface" would forbid this iteration outright, and someone applying that reading would be entitled to reject it.

### What warrants review

**The whole scoping argument above.** If the intent was literally that nothing but Teams may exist, then seeding has to be driven from Teams, or dropped.

### Future work

Real Teams registration is now the only unbuilt item, and it is not something this loop can verify — it needs a tenant.

## Step 2: Building it

**Author:** main

### What I did

Added `/src/core/seeding.ts` (the `Area` shape, an `AreaProposer` interface, and the plan's format and parser), `/src/core/claudeProposer.ts` (reads the codebase read-only and proposes areas), and `/src/seed.ts` (the command). Added an `npm run seed` script.

Two phases with a file between them. `npm run seed` proposes and writes `seed-plan.md`. A developer edits it. `npm run seed -- --write` answers only what was ticked.

Three things are deliberate:

**Nothing arrives ticked.** `toAreas` sets `chosen: false` on every proposal, with a comment saying that is the point. The PRD asks for "a reviewed baseline rather than an unattended bulk index", so there is no flag that seeds everything — the only way to seed is to have chosen.

**Proposing refuses to overwrite an existing plan.** A plan on disk may be one a developer has spent time editing. Re-proposing over it would silently discard that work, so it exits and says to delete the file.

**Writing skips what is already covered.** Seeding twice, or seeding something an asker already triggered, should not be paid for twice.

Review of what gets written needed no machinery at all: entries are files, so the review is the diff. That is what the constitution's "the knowledge base is plain files in the repository" buys, three iterations later.

### Why

The expensive failure here is bulk. A proposal covering five areas came back with fifteen questions, which at roughly a dollar each is fifteen dollars for an unattended run — and a knowledge base full of entries nobody chose. Every guard above exists to make the cost deliberate.

### What worked

The plan parser being forgiving. It is a file a human edits by hand, and a plan that failed because a blank line moved would be a poor way to discover that. `##[X]` with no space, `*` bullets, indented bullets, and extra prose all parse. There is a test for exactly that, written before the live run.

### What didn't work

Nothing failed during the build. One user-visible flaw showed up in the live run and is recorded in Step 3.

### What I learned

The proposer needed to be told what *not* to propose. Without the instruction excluding the build, the tests, the tooling and the repository layout, a codebase-reading model proposes documenting the test suite — which is true, useful to nobody, and exactly the wrong instinct for an audience of product owners and testers. The rule that made the proposals good is "rank by how likely someone is to ask, not by how interesting the code is".

### What was tricky

Choosing the handoff. An interactive prompt would be more direct, but it cannot be run in CI, cannot be reviewed, and cannot be edited — and "edit the questions before they are asked" is part of what the PRD wants. A file is worse ergonomically and better in every way that matters here.

### What warrants review

- **`seed-plan.md` is not gitignored.** A half-edited plan can be committed by accident. The alternative blocks committing it deliberately as a record of what was chosen, which seemed worth more.
- **No dry run.** `--write` reports the cost and then spends it. There is no way to see what it would spend without letting it.
- **`--write` answers questions in order and stops for nothing.** A run that dies halfway leaves some entries written and no record of where it got to; re-running is safe, because covered questions are skipped, but nothing says so.

### Future work

A `--dry-run` that prints what would be asked and what it would cost.

## Step 3: Verifying it

**Author:** main

### What I did

Added five tests for the plan format, the parser, and the choosing logic — bringing the suite to forty-five — then ran the real command against a copy of the app's own source, exercising all three guards and both phases.

### Why

The guards are the feature. A seeding command that quietly does the expensive thing is worse than none, so the tests worth writing are the ones that check it refuses.

### What worked

Every guard fired:

```
=== guard: --write with no plan ===
No …/seed-plan.md. Run `npm run seed` first to propose one.        exit=2

=== propose ===
Proposed 5 areas covering 15 questions -> …/seed-plan.md
Nothing has been written to the knowledge base yet.

=== guard: propose again ===
…/seed-plan.md already exists. Delete it to propose again…          exit=2

=== guard: nothing ticked ===
Nothing is ticked in …/seed-plan.md. Nothing has been written.      exit=1
```

The proposals themselves were better than expected, and in product language throughout. One example, verbatim:

> **Telling the bot an answer is wrong**
> Why: Anyone can challenge an answer straight from the thread, but the bot re-reads the code rather than believing the objection — so it can, and does, stand by what it said, which surprises people.

That is a fair description of a behaviour built ninety minutes earlier, framed by what would surprise a user rather than by what the code does. All five areas arrived unticked.

Ticking one area, trimming it to a single question, and running `--write` produced one entry with a correct question, keywords, `derived-from` list and fingerprint. Re-running `--write` skipped it in 0.45 seconds without spending anything, which is the only test of the already-covered path and would not have been exercised by a single run.

### What didn't work

A grammar bug in my own output, visible on the most likely run of all:

```
1 questions to answer. Roughly a minute and a dollar each.
```

Trivial, and fixed — but it survived writing the code, a typecheck, forty-five tests, and four guard runs, because nothing tests the wording of a log line and I did not read it until it appeared in a real run. The single-item case is the common one for a careful developer ticking conservatively, so this is the message most seeding runs would have shown.

### What I learned

Running the command as a developer would, rather than only calling its internals from tests, is what surfaced both the grammar bug and the already-covered path. The tests exercise `chosenQuestions` and `parseSeedPlan`; they never see a line of output.

### What was tricky

Keeping the live verification cheap without making it meaningless. The full proposal was fifteen questions and about fifteen dollars. Ticking one area and deleting two of its three questions is exactly what the feature is *for* — choosing — so the cheap test and the intended usage turned out to be the same thing.

### What warrants review

- **Only one entry was actually seeded.** The write loop was exercised for a single question; nothing has tested it over ten, where a partial failure would matter.
- **The proposals were judged by reading them.** They look good and are in product language, but "good proposals" is a claim about a model's output on one codebase — and that codebase is small, well-commented, and about the very bot doing the reading.

### Future work

Seed a genuinely unfamiliar codebase and read the proposals. This one was graded on a codebase that describes itself.
