# Diary: Iteration 12 — one entry per behaviour, not one per phrasing

Iteration 2 recorded a defect and left it: two phrasings of the same question that both miss produce two entries saying the same thing, and keyword matching then picks between them arbitrarily. Ten iterations later it is the one property of this product that gets *worse* the more it is used, which is what made it worth taking now.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Eleventh firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes, cheaply where possible.

### What I did

Chose deduplication over the other cheap items — a seeding dry run, splitting the overloaded provenance enum, attributing spend to a thread.

### Why

Everything else on the list is a defect that stays the same size. This one compounds. Every question answered in a new phrasing adds an entry, each near-duplicate makes retrieval's job harder, and a developer reviewing the knowledge base has more to read for no more information. A knowledge base that degrades as it fills is a bad property for a product whose entire premise is accumulating one.

The previous iteration also cost nothing, and this one is mostly hermetic, which matters given roughly fifteen to twenty dollars of derivations tonight.

### What worked

Recognising that the fix is not "detect and discard the duplicate". Both phrasings are real questions real people asked, and both should reach the answer. Merging keeps the second question and throws away only the redundant *file*, which turns a deduplication into a retrieval improvement.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new; the defect had been recorded for ten iterations and only needed picking up.

### What was tricky

Judging the scope. Turning `question` into `questions` touches the entry format, the parser, the serialiser, retrieval, the core, the seeding command and a dozen tests. The smaller version — keeping `question` and adding an `alsoAsked` list beside it — would have been half the diff and two fields meaning the same thing, which is exactly the overloading I criticised in the previous iteration. With sixty-two tests and CI in place, the proper version was affordable.

### What warrants review

Whether merging is right at all. An alternative is to keep both entries and let retrieval prefer the better one, which loses nothing and costs storage. Merging is a lossy decision made automatically.

### Future work

The other cheap items remain.

## Step 2: Building it

**Author:** main

### What I did

An entry now carries `questions: string[]` rather than a single `question`. They are written as a `## Questions` section rather than a frontmatter field, and `parseEntry` reads both that and a legacy single `question:` line, merged and de-duplicated.

`KnowledgeBase.add` looks for an entry that already says the same thing about the same code and, finding one, attaches the new question to it instead of writing a near-duplicate beside it. `replace` preserves every question already known to reach an entry, which removed a piece of bookkeeping the core had been doing by hand since iteration 5.

Sameness requires both halves:

```ts
if (!entry.fingerprint || entry.fingerprint !== derivation.fingerprint) return false;
return similarity(entry.answer.shortAnswer, derivation.answer.shortAnswer) >= DUPLICATE_SIMILARITY;
```

Identical fingerprint means it came from exactly the same files. That alone is not enough — one file describes many behaviours — so the short answers must also be similar. `similarity` is Jaccard overlap over the same tokeniser retrieval uses, so it is free, order-independent, and stems the same way.

### Why

Questions moved out of frontmatter for a concrete reason: questions contain commas, and every list in that frontmatter is comma-separated. `keywords` and `derived-from` are safe because the writer strips commas from them; doing that to a question would mangle it. A body section is parsed by the existing section splitter and holds anything.

### What worked

Making `replace` responsible for keeping the questions. The core had been carrying `question: known.question || question` through both the refresh and the dispute paths — a rule about entry identity living in the wrong module, and one I had already had to fix once. Both call sites are now plain `replace(entry, derivation)`.

### What didn't work

Two test failures, both mine, and the first was a real ordering bug.

**Merging reshuffled the file.** The serialiser put the new question first, so every merge rewrote the whole list in a different order. In a version-controlled knowledge base that is a diff full of moved lines for one added question. Changed to append: existing questions keep their order and the new one goes on the end, so a merge is one added line.

**A threshold I guessed at.** I asserted that a paraphrase using a different noun would score above 0.6; it scores 0.500. Rather than adjust the assertion to match, I measured the cases that actually matter:

```
1.000  the card adds credit || credit the card adds
0.500  a gift card adds credit to the balance || a voucher adds credit to the balance
0.636  Access continues until the end of the period already paid… || Access continues to the end of the period the customer already paid…
0.143  An unused gift card expires two years after… || A gift card is redeemed by entering its code…
```

The realistic merge case is the third: the same behaviour derived twice, worded slightly differently, at 0.636. Two different behaviours from the same file score 0.143. So 0.6 separates them — but the margin above the line is thin, and a slightly more divergent re-wording would fail to merge.

That is the right way round. Failing to merge leaves a duplicate, which is merely the situation before this iteration; merging wrongly loses a behaviour permanently. The threshold and its measurements are now a comment and a test.

### What I learned

I have now twice in one night written an assertion from intuition about a number and been wrong — the earlier one was assuming a smaller model would be faster. Both times the fix was to print the actual values first. Guessing a threshold and then tuning the test to whatever the code produces is the failure mode this avoids; measuring first and writing the threshold down with its evidence is what makes it reviewable.

### What was tricky

Keeping the original intent of a test I had to change. "Storing an entry never overwrites one that is already there" now legitimately fails, because storing the same behaviour twice *should* merge. But it was protecting something real — that a title collision must not clobber an existing file. Rather than relax it, I split it into four: the same behaviour merges, a different behaviour from the same code stays separate, identical wording from *different* code stays separate, and a title collision between different behaviours still gets its own file.

### What warrants review

- **`DUPLICATE_SIMILARITY = 0.6` was calibrated on four hand-written pairs.** It separates them, with about 0.04 of margin on the case that matters.
- **A hand-written entry has no fingerprint and can never be merged into**, which is deliberate — nothing should silently rewrite what a person wrote — but it means the duplicate a developer creates by hand stays a duplicate.
- **Merging is irreversible.** The losing derivation's wording is discarded; only its question survives.

### Future work

Nothing outstanding.

## Step 3: Verifying it

**Author:** main

### What I did

Grew the suite to sixty-nine, then ran the check that mattered most for a change to the storage format — and it cost nothing.

### Why

The risk in changing an entry's shape is not the code that writes it, which the tests cover. It is the entries that already exist. Every deployment of this bot would have a knowledge base full of files in the old format.

### What worked

Three real entries written by the real engine earlier tonight — in the old format, with a `question:` frontmatter line — loaded unchanged:

```
ok    livekb2/what-the-bot-does-when-the-code-reading-service-is-unreachab.md
        questions: ["What does the bot do when it cannot reach the service that reads the code?"]
ok    seedkb/flagging-an-answer-as-wrong-in-the-conversation.md
        questions: ["how do I tell the bot that an answer is wrong?"]
ok    livekb3/refreshing-a-stored-answer-when-the-code-behind-it-has-chang.md
        questions: ["What happens when a stored answer is out of date?"]
```

Their single question is lifted into the list, and everything else is untouched. Those files were not written for this test — they are the by-products of earlier iterations' live runs, which made them the most honest available sample of the old format.

The new format round-trips, and reads as intended by someone reviewing a diff.

### What didn't work

Nothing failed.

### What I learned

The best available test data was already sitting in the scratch directory. I had been about to spend two dollars re-running the soak to exercise a format change, when three real machine-written entries from three earlier iterations were the exact thing the change put at risk, and reading them cost nothing.

### What was tricky

Deciding not to run the soak. It is the designated check for changes crossing these mechanisms, and this change touches storage, so skipping it takes some justifying. The reasoning: the soak's coverage of this change is the write-then-read path, which the hermetic tests now cover in five ways, plus backwards compatibility, which the soak does not test at all because it starts from an empty knowledge base. The free check covered the part the soak would have missed.

### What warrants review

- **The soak has not been run against this change.** The next iteration that runs it will be the first to exercise merging with real derivations.
- **No real pair of derivations has ever been merged.** Every merge test uses fixtures I wrote, and the 0.636 figure comes from two sentences I composed to resemble a re-derivation rather than from two actual ones.

### Future work

Watch a real merge happen. The next soak run that asks the same thing two ways would produce one, and its similarity score is worth reading.
