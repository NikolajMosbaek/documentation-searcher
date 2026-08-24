# Diary: Iteration 16 — a soak that works on somebody else's codebase

`npm run soak` asked questions about this bot. That made it an integration check for this repository, when the thing it is actually good for is telling somebody whether the product works against *their* codebase.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Fifteenth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Made the soak's questions come from a file, with the existing ones as the built-in default.

### Why

Iteration 10 recorded this as a limitation when the soak was written: "Its questions are about this bot specifically. Pointed at another codebase the questions will not match it, most turns will miss, and the checks will fail for reasons that are not defects."

Of what is left on the list, this is the only item with value to somebody other than me. Every install of this product points at a different codebase, and the question "does this actually work against mine" is exactly what the soak answers — for one codebase, hard-coded.

### What worked

Separating the scenario from the runner. The questions and their validation went into `/src/soakScenario.ts`, which is testable by `npm test`; the runner stays untested because it costs dollars to run. That split means the part with logic in it is covered and the part that is mostly orchestration is not.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new.

### What was tricky

Working out which parts of the scenario are actually codebase-specific. Four of the five are. The fifth — the second objection, used to trigger the cooldown — is not: any dispute exercises that path, and it need not mean anything about the code. It stays hard-coded with a comment saying why, rather than being made configurable for symmetry.

### What warrants review

Whether the soak is worth this. It is a developer tool for a product that is not yet deployable, since Teams registration is unbuilt.

### Future work

A seeding dry run is the last thing on the list.

## Step 2: Building it

**Author:** main

### What I did

`SoakScenario` has five fields: the question, a rephrasing, a follow-up, a false claim, and a marker phrase from that claim. `parseScenario` is strict — every field must be a non-empty string, and a missing one is an error naming the field.

The last check is the one worth describing. `falseClaimMarker` must actually appear in `falseClaim`:

```
scenario.json: falseClaimMarker 'never appears' does not appear in falseClaim,
so the check that the bot did not adopt the claim would pass without testing anything
```

That check exists because the soak's most important assertion is that the bot does not agree with an objection the code does not support. It works by asserting a phrase from the objection is absent from the answer afterwards. If someone writes a marker that was never in the claim, the assertion passes forever while testing nothing — and reports PASS while doing it.

### Why

The strictness is a deliberate contrast with the seeding plan parser, which is forgiving about spacing, bullet styles and stray prose. A plan is edited by hand halfway through a task and should tolerate that. A scenario is written once, and a silently missing field would make the soak quietly stop checking something.

### What worked

The drift guard from two iterations ago caught this iteration's own changes, unprompted:

```
not ok 74 - every source file is described in the README
not ok 76 - every setting the code reads is documented
```

A new module and a new environment variable, both undocumented, both caught before I had thought about the README. That is the first time it has fired on a real change rather than a deliberate break, two iterations after being written — and it fired on me, which is who it was written for.

### What didn't work

Nothing failed.

### What I learned

Building the guard was worth more than fixing the three stale claims that motivated it. The claims were a symptom; this is the second time in two iterations that documentation would have gone stale, and this time something noticed without me remembering to look. The previous time — the spend attribution line in *Known limits* — was prose, which the guard cannot read, and I caught it by luck.

### What was tricky

Nothing.

### What warrants review

- **The runner itself is still untested.** Its wiring — which scenario field reaches which turn — was checked by reading, not by a test.
- **A scenario can be valid and useless.** Nothing checks that the question is answerable from the codebase, so a badly chosen one produces a run where every check fails for reasons that are not defects. That was the original problem and it is narrowed, not removed.

### Future work

None.

## Step 3: Verifying it

**Author:** main

### What I did

Six tests for the parser, then exercised every failure path of the real command — since the happy path costs a few dollars and the failure paths cost nothing.

### Why

The valuable property is that a bad scenario fails *before* any money is spent. That is exactly what can be checked for free.

### What worked

Every failure mode reports clearly and exits 2 without touching the codebase or the engine:

```
--- useless marker ---     falseClaimMarker 'never appears' does not appear in falseClaim…   exit=2
--- incomplete ---         …is missing a non-empty 'rephrasing'                             exit=2
--- missing file ---       ENOENT: no such file or directory, open '/nope/missing.json'      exit=2
--- no codebase at all --- Set DOCSEARCHER_CODEBASE to a codebase to run the soak against.   exit=2
```

And a *valid* scenario with a deliberately broken codebase path fails later, at the copy step — which is the evidence that parsing happens first and a bad scenario can never reach the expensive part.

### What didn't work

I reported a defect to myself that was not one. The missing-file case appeared to exit 0:

```
--- missing file ---
ENOENT: no such file or directory, open '/nope/missing.json'
exit=0
```

That case was the only one I had piped through `tail`, so `$?` was `tail`'s status rather than the command's. Re-running it without the pipe gave `exit=2`. The behaviour was correct throughout; the measurement was wrong.

Worth recording because it is the mirror image of the failures this project keeps hitting. The usual one is a check that passes while proving nothing. This was a check that appeared to fail while nothing was wrong — and the cost of that is chasing a phantom, or worse, "fixing" code that was already right.

### What I learned

`$?` after a pipeline is the last command's status. I know this; it still produced a wrong reading because the pipe was added for output tidiness in one case out of five and the inconsistency was invisible. Measuring five things five slightly different ways is how one of them comes out wrong.

### What was tricky

Nothing, once the measurement was corrected.

### What warrants review

- **The happy path was not run.** The soak has not been executed against a custom scenario, only against failures of one. That would cost a few dollars and exercise mostly code that has not changed.
- **Six parser tests, none deliberately broken.** The pattern of confirming each test can fail was not applied here; the parser's assertions are `throws` matchers, which fail loudly if the throw stops happening, but that is an argument rather than a check.

### Future work

None.
