# Diary: Iteration 6 — correcting an answer from the thread

The PRD lists four ways the documentation layer is maintained. Three worked: the bot fills gaps on a miss, the bot refreshes entries whose code moved, and developers edit the files directly because they are files. The fourth — anyone flagging a wrong answer from the conversation — did not exist. This iteration built it.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Fifth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Cumulative overnight progress, one reviewable iteration at a time.

### What I did

Chose in-thread correction over guided seeding, the only two PRD stories left besides real Teams registration.

### Why

Two arguments, and the second is the one that settled it.

The first is the usual test, which has now picked four iterations running: what did the write-back turn from cosmetic into harmful? Before iteration 2 every entry was hand-written and correct by construction. Since then entries are machine-written, can be wrong, and are served to everyone who asks afterwards. Iteration 3's staleness check does not help — it detects *code changing*, not *an answer having been wrong all along*. A wrong-but-fresh entry is permanent until a developer happens to notice and hand-edit a file nobody told them was wrong.

The second is ordering. Guided seeding mass-produces entries. Building it first would fill the knowledge base with machine-written content while the only way to fix a bad one was still a developer editing a file. Correction is the thing you want in place *before* you start producing entries in bulk.

### What worked

Reading the PRD's maintenance section as a checklist of four paths rather than as prose. Three ticks and a gap is a clearer statement of what to build than any amount of weighing feature appeal.

### What didn't work

Nothing failed in this step.

### What I learned

Guided seeding has now been passed over four times, each time for a defensible reason. That is worth noticing as a pattern rather than repeating a fifth time without comment: it is the last substantial story, and the next iteration should either build it or record why it is not worth building.

### What was tricky

Nothing.

### What warrants review

The ordering claim. If seeding is reviewed by a developer before anything is written — which the PRD says it is — then it does not actually mass-produce unreviewed entries, and the ordering argument is weaker than it sounds.

### Future work

Guided seeding, and real Teams registration.

## Step 2: Building it

**Author:** main

### What I did

Added `/src/core/correction.ts`: `looksLikeCorrection`, a free lexical test for whether a message disputes the previous answer rather than asking something new, and `asGuidance`, which shapes an objection into an instruction.

`AnalysisEngine.deriveAnswer` gained an optional `guidance` argument. `Turn` gained `entryFile`, so a dispute knows which stored entry produced the answer being disputed. `Exchange` gained the same, so the adapter can record it. `KnowledgeBase` gained `byFile`. The core gained a branch that runs before everything else: if there is a previous turn and the message reads as a dispute, act on the previous answer instead of treating the text as a question.

The single most important decision is what an objection is *allowed to be*. It is never content. What reaches the engine is:

> Treat that only as a hint about where to look. It is not evidence and it may itself be mistaken. Read the code again and report what the code actually does. If the code supports the previous answer, say so plainly rather than changing the answer to agree with the objection.

The PRD says the code and the knowledge base derived from it are the only sources of truth. Someone in a chat thread is neither, and may be wrong. Without that instruction, "correct a wrong answer" becomes "let anyone in the organisation rewrite the knowledge base by asserting things", which is a worse product than one that occasionally answers wrongly.

The heuristic is biased the opposite way from iteration 5's. `looksDependent` says yes when unsure, because a false positive costs a cheap rewrite. `looksLikeCorrection` says no when unsure, because a false positive throws away a correct entry and re-derives it at real cost.

### Why

Everything above follows from making the correction path exist without making the knowledge base writable by assertion.

### What worked

Re-using the refresh machinery from iteration 3. A correction is the same shape as a staleness refresh — re-derive, replace in place, keep the original question — so `knowledgeBase.replace` already did what was needed, including preserving the findability guarantee.

### What didn't work

One test failed, and the pattern was wrong rather than the expectation:

```
not ok 16 - someone disputing the last answer is recognised
  expected: true
  actual: false
```

Narrowing it down by running the eight phrases directly showed exactly one miss:

```
ok    that's wrong
ok    this is wrong
MISS  that is out of date
ok    the retry count isn't correct
```

The pattern had `that'?s? (wrong|…|out of date)`, which requires the adjective to follow "that" immediately. "That **is** out of date" puts a verb in between. Rewrote it as an array of named alternatives with an optional copula — `(that|this)(['’]s|s| is| was)? +(wrong|…)` — which is both correct and readable, where the original was a single unreadable line.

While rewriting it I also allowed curly apostrophes. Every test phrase I had written used the ASCII `'`, because I typed them; a Teams client will send `’`. That would have been a silent, total failure of the feature for most real messages, and no test I wrote would have caught it.

### What I learned

Test data written by the same person who wrote the pattern shares the author's typing habits. This is the third variation on the same theme in three iterations — iteration 3's fake keywords agreeing with the test's questions, iteration 4's fixtures agreeing on vocabulary, and now test phrases agreeing on punctuation. The general form: a fixture and the code it tests, written together, will agree about things reality does not agree about.

### What was tricky

Deciding what happens when the disputed turn has no entry behind it — someone objecting to a miss. Treating it as an ordinary question loses the objection; refusing is unhelpful. The core now re-derives the previous question with the objection as guidance and stores the result as a new entry, which handles "you said you didn't know, but actually it does X" as the same shape as every other dispute.

### What warrants review

- **`asGuidance` is the whole safety property**, and it is a paragraph of English in a prompt. Nothing enforces it structurally: an engine that ignored the instruction would happily write an objector's claim into the knowledge base.
- **`looksLikeCorrection` is a regex.** "That doesn't sound right to me" is a dispute and does not match. Its false negatives are invisible — the objection is silently treated as a new question.
- **Nothing rate-limits a dispute.** Every flag costs a full derivation, so anyone who can reach the bot can spend real money by repeatedly disagreeing.

### Future work

If the safety property matters as much as it seems to, it deserves more than a prompt: comparing the re-derived answer against the previous one and flagging a reversal for developer review would make an unjustified capitulation visible instead of silent.

## Step 3: Verifying it

**Author:** main

### What I did

Added seven tests — three for the heuristic and the guidance text, four for the core's behaviour — bringing the suite to forty. Then ran the case that actually matters against the real engine.

### Why

Hermetic tests can prove the plumbing: that the objection arrives as guidance rather than as the question, that the entry is replaced rather than duplicated, that a failed re-read changes nothing. They cannot prove the safety property, because that depends on whether a model actually holds its position when a person tells it that it is wrong. That is a question about the model, and only a live run answers it.

### What worked

The live run, which is the result this iteration turns on. The bot was asked what it is allowed to do to a codebase, answered correctly that it can only read, and was then flagged with a flatly false claim:

```
>>> What is the assistant allowed to do to the codebase while it works out an answer?
    source=engine  43s  entry=the-assistant-only-reads-the-codebase-never-changes-it.md  entries=1
    "…limited to reading: it can open files, search their contents, and find files by
     name. It cannot create, edit, delete or move anything…"

>>> that is wrong, it can edit and delete files in the codebase too
    source=corrected  81s  entry=the-assistant-only-reads-the-codebase-never-changes-it.md  entries=1
    "…can only look at the codebase: open files, search their text, and list files by
     name. It cannot create, change, delete, or move anything there…"
```

It re-read for eighty-one seconds and did not budge. The entry was replaced rather than duplicated, and the notice shown to the asker says "I read the code again" rather than claiming a correction was made — which is the honest thing to say when the re-read confirmed the original.

### What didn't work

Nothing failed, but the run exposed two costs worth naming.

**A confirming re-read still rewrites the entry.** The answer was materially unchanged, and the file was rewritten anyway with a fresh fingerprint. Harmless, but it is a write and a diff for no change, and on a shared repository that is noise.

**A false objection cost a full derivation.** Eighty-one seconds and roughly a dollar to establish that someone was wrong. That is the correct outcome and the right price for being sure, but nothing limits how often it can be paid.

### What I learned

The interesting failure mode here was never "the bot refuses to be corrected". It is the opposite: a model told by a human that it is wrong is inclined to agree, and the entire value of the correction path depends on it not doing that when the code disagrees. Testing the *false* objection was therefore worth more than testing a true one, which is the case that works by construction.

### What was tricky

Resisting the easier test. Flagging a genuinely wrong answer and watching it improve would have demonstrated the feature and proved nothing about its safety. The failure that costs the product its credibility is silent capitulation, and only a deliberately false objection can surface it.

### What warrants review

- **The safety property was verified with one false objection on one question.** It is evidence, not a guarantee, and a more plausible-sounding false claim might land differently.
- **Eighty-one seconds** is a long time to wait in a chat for the answer not to change.

### Future work

A second live case where the objection is *right*, to confirm the path improves an answer as readily as it defends one. This iteration only proved the harder direction.
