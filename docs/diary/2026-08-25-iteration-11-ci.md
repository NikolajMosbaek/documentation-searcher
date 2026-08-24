# Diary: Iteration 11 — running the tests without being asked

Sixty-two tests, a soak, a public repository, and nothing ran any of it unless someone remembered to. This iteration made that automatic, and in doing so tested a claim these diaries had been making without evidence.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Tenth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Chose CI, from a shortlist of cheap items — splitting the overloaded provenance enum, a seeding dry run, entry deduplication, keeping tests out of the build.

### Why

Two reasons, and the second is the one that made it the pick rather than a chore.

The first is ordinary: a test suite nothing runs protects only the person who remembers to run it, and this repository is public and has a remote that anybody could open a pull request against.

The second is that CI tests something I could not test locally. Every one of tonight's runs happened on a machine with Claude Code authenticated. I have written in several diaries that the suite "needs no network or credentials", and I had no evidence for it — a test that quietly reached for the environment's credentials would have passed every single time. A clean runner is the only thing that can falsify that, and it is exactly the sort of claim that is embarrassing to discover was false later.

The previous iteration also flagged spend: roughly fifteen to twenty dollars of derivations tonight. CI costs nothing to build and nothing to verify, which made it the right thing to do next on those grounds too.

### What worked

Checking feasibility before writing the workflow, which is becoming a habit worth keeping. The Agent SDK ships eight platform-specific optional dependencies and this lockfile was generated on darwin-arm64 — a well-known way for `npm ci` to fail on a Linux runner. All eight platforms turned out to be present in the lockfile, so it resolves. Had they not been, the workflow would have failed on its first run for a reason that has nothing to do with CI.

### What didn't work

Nothing failed in this step.

### What I learned

The habit that keeps paying off is asking "what would make this not work" before writing it, rather than writing it and reading the error. That is three iterations running: the missing plain-SDK credential in iteration 9, the CLI exclusion in the PRD in iteration 7, and the lockfile here.

### What was tricky

Nothing. The judgement was in choosing it, not building it.

### What warrants review

Whether repository tooling belongs in a product iteration at all. The constitution's "defer infrastructure" is about databases and queues — things the product depends on at runtime — not about being able to tell whether the product works, so this seemed clearly outside it.

### Future work

The soak is deliberately not in CI: it costs a few dollars per run and needs credentials. Nothing runs it automatically, and nothing should.

## Step 2: Building it, and what CI immediately found

**Author:** main

### What I did

Added `/.github/workflows/ci.yml` — checkout, Node, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, on a matrix of Node 20.11 (the floor `engines` declares) and 22. Added `/tsconfig.build.json`, which extends the main config and excludes `*.test.ts`, and pointed `npm run build` at it.

Pushed it and watched the run rather than reading the YAML and declaring it correct.

### Why

The tests-in-`dist` problem was recorded as untidy in iteration 4 and left alone because nothing but a person ran the build. Something other than a person was about to, so it became worth the two-line fix. Keeping them in `tsconfig.json` means the typecheck still covers them; excluding them from the build config means `dist` is only the product.

### What worked

The first run passed on both Node versions in twenty-one seconds:

```
✓ check (20.11) in 21s
  ✓ Run npm ci
  ✓ Run npm run typecheck
  ✓ Run npm test
  ✓ Run npm run build
```

That is the claim tested. `npm test` ran to completion on a machine with no `ANTHROPIC_API_KEY`, no Claude Code, and no way to reach either. The suite is hermetic, and now that is a fact rather than an intention.

`dist` was verified clean of test files locally before pushing.

### What didn't work

The run passed and annotated itself:

```
! Node.js 20 is deprecated. The following actions target Node.js 20 but are
  being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4
```

Not a failure, and easy to leave — a green tick is a green tick. But it is CI reporting a real fact about the workflow on its very first run, which is the entire reason for having it, and ignoring the first thing it says would set an unfortunate precedent. Bumped both to `v5` and watched again: green, no annotations.

### What I learned

The deprecation was invisible from here. Nothing about reading the workflow file suggests which Node runtime an action's implementation targets, and I would not have known to check. It took running the thing on the machine that actually runs it — which is a small instance of the same lesson the soak taught an hour earlier.

### What was tricky

Where to get feedback before `main`. The workflow triggers on pushes to `main` and on pull requests, so an iteration branch gets nothing, and `workflow_dispatch` cannot be triggered until the workflow already exists on the default branch. Opening a pull request would have worked but is an outward-facing action on a public repository that was not asked for. Merging to `main` and watching, then fixing forward in a second commit, matched the pattern every other iteration has used and left the whole exchange in the history.

### What warrants review

- **CI does not run on iteration branches.** Only `main` and pull requests, so a branch is unchecked until it lands.
- **Nothing pins the actions by SHA.** `@v5` is a moving tag, which is convenient and is supply-chain trust in a public repository.
- **Two commits for one iteration.** The second exists because the first passed and told me something, which seemed worth leaving visible rather than hiding behind an amended commit.

### Future work

Nothing outstanding.

## Step 3: Verifying it

**Author:** main

### What I did

Watched both runs to completion with `gh run watch --exit-status`, and checked the annotations on the second.

### Why

"CI is set up" is a claim with an obvious failure mode: a workflow that never runs, or runs and is never looked at. The exit status and the absence of annotations are the evidence.

### What worked

Both runs green on both Node versions; the second with no annotations at all. Total wall-clock for the feedback loop is about twenty-five seconds, which is fast enough that it will actually be used.

### What didn't work

Nothing.

### What I learned

`gh run watch --exit-status` makes CI verifiable from the same place the work happens, which is what made fixing the annotation feel worth doing rather than a detour.

### What was tricky

Nothing.

### What warrants review

Both runs were on `main` after the fact. Nothing has yet exercised the pull-request trigger, so that half of the workflow is unverified.

### Future work

The pull-request path will be verified the first time someone opens one.
