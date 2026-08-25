# Diary: Iteration 32 — entries stay with the code they describe

Asked for a guarantee that descriptions of a private codebase can never land in this public repository. The honest answer was that the default was wrong, not merely risky, and wrong against the PRD rather than only against good sense.

## Step 1: The request, and what it turned out to be

**Author:** main

### Prompt Context

**Verbatim prompt:** "I need it so descriptions of my private repo never lands in the public repo"

**Interpretation:** A guarantee, not a reminder. Something that makes the bad outcome impossible rather than avoidable.

**Inferred intent:** They want to point this at real work code without having to remember an environment variable to stay safe.

### What I did

Read the PRD before writing anything, and found the default contradicted it.

### Why

The obvious response was a warning and an environment variable, which is what the README already said. That is a reminder, and a reminder is exactly what the request rules out.

Looking for where entries *should* live turned up user story 8: "As a developer, I want the knowledge base to live with the code as editable files, so that I can correct an entry and have that correction reviewed alongside the change that caused it."

Alongside the change that caused it. An entry describing a behaviour and the code implementing that behaviour belong in the same pull request, which means the same repository — the repository of the *codebase being documented*, not the one holding the bot.

The default was `<bot>/knowledge-base`. It had been that since iteration 1 and nothing had questioned it, because for thirty-one iterations the bot was only ever pointed at itself, where the two are the same directory and the distinction is invisible.

### What worked

Treating a safety request as a design question. The leak and the PRD violation have the same cause and the same fix: put entries where the PRD says they go, and the private-code-in-a-public-repo scenario stops existing rather than being guarded against.

### What didn't work

Nothing failed, but it is worth noting how long this survived. Thirty-one iterations, including one whose entire subject was pointing the bot at somebody else's codebase — and in that iteration I wrote the derived entries to a scratch directory by hand, noticed it was the right thing to do, and did not notice the default made it necessary.

### What I learned

A default that is only ever exercised in the degenerate case is not a tested default. Bot documents bot: knowledge base beside the bot is both "beside the code" and "beside the bot", and nothing distinguishes them. The first real use is where it breaks.

### What was tricky

Establishing that this is a correction rather than a preference. The PRD sentence is unambiguous once found, and it changes the change from "a safer default" to "the specified one".

### What warrants review

**Existing deployments would move.** Anything already running with the old default has its entries in the bot's directory and would start reading an empty knowledge base after this. There are none, but it is a breaking change.

### Future work

None.

## Step 2: The rule, and the refusal

**Author:** main

### What I did

Added `/src/core/whereEntriesGo.ts`, used by both the bot and the seeding command.

Entries now default to `<codebase>/knowledge-base`. An explicit `DOCSEARCHER_KNOWLEDGE_BASE` is still honoured. With no codebase configured nothing is ever derived, so the bot falls back to its own example entries.

Then the part that makes it a guarantee rather than a default: the bot refuses to start if the knowledge base would sit inside its own repository while the codebase being read is somewhere else.

```
Refusing to write entries about another codebase into this repository.
  codebase being read : /Users/…/documentation-searcher
  entries would go to : /Users/…/documentation-searcher-app/knowledge-base
  which is inside     : /Users/…/documentation-searcher-app
```

Exit code 2, before a single question is answered.

### Why

A default can be overridden by accident — a stale environment variable, a copied command, a script written before this change. The refusal covers the case where someone sets the variable to the wrong thing, which is the realistic way this goes wrong now that the default is right.

The rule allows every arrangement that makes sense: entries beside their codebase, entries somewhere else entirely, and the bot documenting itself, which is what this repository's own entries are. It refuses exactly one thing.

### What worked

Both directions verified by running them rather than by reading:

- Pointed at a foreign codebase with the store forced inside this repository: refused, exit 2.
- Pointed at a foreign codebase with the default: created `knowledge-base` inside *that* codebase, loaded zero entries from it, and left this repository's own knowledge base untouched — confirmed with `git status`.

### What didn't work

Nothing.

### What I learned

The check is four lines of path arithmetic. The work was deciding what it should permit, and that came from the PRD rather than from thinking about paths.

### What was tricky

Making sure "the bot documenting itself" stays allowed. It is the case this repository's whole evaluation corpus depends on, and a rule phrased as "never write into the bot's directory" would have broken it.

### What warrants review

- **The rule compares directory containment.** A symlink pointing from inside the repository to somewhere else would defeat it.
- **It protects this repository from other codebases.** It does not stop somebody pointing the bot at codebase A and storing entries in unrelated repository B, if both are outside this one.

### Future work

None.

## Step 3: The audit

**Author:** main

### What I did

Added a test that reads every entry committed to this repository — the three examples and the thirty-one-entry corpus — and fails if any of them names a file outside it.

### Why

The refusal stops entries being written in the wrong place from now on. It does nothing about anything already there, or anything that arrives by other means: a file copied by hand, a run from before this existed.

Since `derived-from` records exactly which files an entry came from, the check is cheap and exact. Anything absolute, or climbing out with `..`, describes code this repository does not contain.

### What worked

It passes, which is the answer to the question actually asked: nothing describing private code is in this repository today. That is now asserted on every push rather than being something I checked once and said so.

### What didn't work

Nothing.

### What I learned

`derived-from` was added in iteration 2 for a staleness check, flagged there as possibly dead weight, and has now been load-bearing for three separate things — staleness, the merge rule, and this. Recording where an answer came from turns out to be worth more than the reason it was recorded for.

### What was tricky

Nothing.

### What warrants review

- **The audit trusts `derived-from`.** An entry with the field stripped passes regardless of what it describes.

### Future work

None.
