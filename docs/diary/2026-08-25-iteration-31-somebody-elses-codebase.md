# Diary: Iteration 31 — somebody else's codebase

Every live run in thirty iterations pointed this bot at the repository it lives in. Iteration 2 recorded why that is a weak test — "a small, clean, TypeScript codebase with rich comments, which is close to a best case" — and nothing since had tried anything else. This did.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Thirtieth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Pointed the bot at `@microsoft/teams.apps` — a published library sitting in `node_modules`, shipped as compiled JavaScript and type declarations, no source, no comments, a hundred and eighty files — and asked it two questions.

### Why

It is the last claim in this project that had never been tested at all, and it is the claim the product rests on. Everything else measured tonight is about how well the bot manages its own knowledge base; this is whether the thing can read a codebase in the first place, on a codebase that was not built to be read.

It also answers a question the corpus work could not. Growing the knowledge base kept running into the same ceiling — this repository only has so many documentable behaviours — and the reason is that there was only ever one subject.

### What worked

The choice of target. Compiled output is a harder case than an unfamiliar repository: the identifiers survive, the comments do not, the formatting is machine-generated, and nothing in it was written to explain itself. If the bot needs comments to work, this is where it fails.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing yet.

### What was tricky

Deciding what to keep. The entries derived from a third-party library are about somebody else's code and belong in neither this repository nor its evaluation corpus, so they were written to a scratch directory and left there. The finding is the result, not the entries.

### What warrants review

Two questions against one library.

### Future work

None from this step.

## Step 2: The result, and checking it rather than admiring it

**Author:** main

### What I did

Read the two answers, then went into the library and checked whether they were true.

### Why

Both answers were detailed, confident, in fluent product language, and contained no code references at all. That is exactly what a good answer looks like and exactly what a confabulated one looks like, and this project has spent the night learning that the difference is only visible if you go and look.

### What worked

They are accurate, and accurate about details that a plausible guess would not produce.

The answer said the app "records a debug-level log line naming the kind of message received (and, for action-style messages, the specific action name)". The library says:

```js
this.options.log.debug(`activity/${activity.type}${activity.type === 'invoke' ? `/${activity.name}` : ''}`);
```

The conditional suffix for invoke activities is a real quirk of that one line, described correctly and in words that never mention it.

Three more claims held the same way: an unhandled message ends in `{ status: 200 }` with no body, which the answer called "an empty success acknowledgement"; a missing token validator returns `401 unauthorized`, which the answer gave as "if the app has no identity details at all, the message is rejected"; and handler selection is `router.select(activity)`, which the answer called "the list of registered handlers whose matching rules apply".

Zero code references in either answer, from a codebase whose only content is code.

### What didn't work

Nothing failed, but the price is worth recording. The two answers cost **$1.26 and $1.31**, and took 96 and 80 seconds. On this project's own source the range is $0.60 to $1.15 and 70 to 85 seconds.

About half as much again. Iteration 9 predicted this — "a large or unfamiliar one will read more files and cost more, and nothing here bounds that beyond `DOCSEARCHER_MAX_USD`" — and it is now measured rather than assumed. The default ceiling of five dollars still has room, but a genuinely large codebase would find it.

### What I learned

The product works. That sounds like a small thing to conclude at iteration 31, but everything before this measured the machinery around the answer — retrieval, staleness, merging, cost, the judge — against a codebase chosen because it was convenient. The one thing none of it tested is whether the answers are any good when the bot has not, in effect, been reading about itself.

They are. On compiled JavaScript, with no comments, first try, twice.

### What was tricky

Resisting the conclusion before checking it. Two fluent answers is not a result; two fluent answers that survive being checked against the source is. The check took four greps and changed what this iteration is allowed to say.

### What warrants review

- **Two questions, one library, both about behaviour near the entry point.** A question about something buried deep in that library might go differently.
- **The library is compiled TypeScript with type declarations**, which is unusually legible for compiled output. Minified code would be a different test.
- **The answers were checked by me**, against code I skimmed for the purpose.

### Future work

The obvious next test is a codebase in a language the bot has no type declarations for, and one large enough to make the five-dollar ceiling bind.
