# Diary: Iteration 26 — what doubling the corpus broke

Every measurement this project has made was made on twelve entries. Doubling that to twenty-four broke two of them, and the way it broke them says the same thing twice: a number measured on a small corpus does not survive a larger one.

## Step 1: Growing it

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Twenty-fifth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Ran the seeding command over the thirteen-question plan generated in iteration 7, adding twelve entries to the corpus, then re-ran every evaluation.

### Why

The largest item in the backlog, and the only one left that needed spending rather than thinking. It also exercised the seeding write loop over thirteen questions, which iteration 7 recorded as untested beyond one.

### What worked

The write loop, including the part nobody had tried. The first run hit a ten-minute limit after eight entries; re-running skipped those eight and continued. That is the resume behaviour iteration 7 said was safe but untested, and it was tested by accident.

The skip logic also fired on questions covered by entries derived *earlier in the same run* — the plan asks about staleness three ways, and only some of them cost anything.

### What didn't work

Nothing failed here, though the timeout was a reminder that thirteen derivations take a quarter of an hour.

### What I learned

Nothing new in this step.

### What was tricky

Deciding to spend about nine dollars in one iteration. It was the only way to test the thing most likely to be wrong.

### What warrants review

The new entries are about this bot, so the corpus is still about two subjects.

### Future work

None from this step.

## Step 2: Three failures, two of them real

**Author:** main

### What I did

Ran the evaluation at twenty-four entries and worked out which failures were the product and which were my labels going stale.

### What worked

The distinction mattered, and two of the three were genuine:

```
if the bot has never seen my question before, what does it do?
  SERVED: what-the-bot-does-when-the-code-reading-service-is-unreachab.md
    4.45 cov=1.00  <- served
    2.12 cov=0.80

how many people work here?
  SERVED: how-much-conversation-history-the-bot-keeps.md
    5.91 cov=0.75  <- served
    2.79 cov=0.50
```

Both cleared all three thresholds — score, coverage, and twice the runner-up — and both are wrong. The second is a question about staffing answered from an entry about conversation history.

The third failure was mine: a similarity of 0.885 between two entries I had not labelled as duplicates, which are the same behaviour derived on different runs.

### What didn't work

The thresholds, and not by a little. They were measured in iteration 19 against twelve entries, where they served nothing wrong. At twenty-four they serve two wrong answers out of seventeen questions.

The reason is structural and was written down at the time without being believed hard enough: a BM25 score grows with the size of the corpus and the rarity of the words in it. A number that is right for twelve entries is wrong for twenty-four and wrong again for a hundred. Re-tuning buys time, not correctness.

### What I learned

The response is to stop tuning. Retrieval no longer decides anything: `best` is gone from the interface, and the three constants with it. What remains is a shortlist and one guarantee — a question asked before in exactly those words is answered immediately and for nothing, which needs no scoring at all.

Everything else goes to a judge. That extends a cost the previous iteration had already accepted for most questions to all of them: a few seconds and a few cents, against a dollar and a minute for a fresh answer, and against two wrong answers in seventeen.

Deleting a tuned constant is a better outcome than re-tuning it. There are three fewer numbers in this system than there were, and the thing that replaced them — asking something that can read — does not care how large the corpus is.

### What was tricky

Seeding had to change too. Its "already covered" check used the same lexical decision, so removing it would have made seeding re-derive questions it already answers, at a dollar each. It now asks the judge, which costs cents.

### What warrants review

- **Every question but an exact repeat now costs a model call.** That is the deliberate trade and it is not free.
- **The judge is now the only thing standing between a shortlist and a wrong answer.**

### Future work

None.

## Step 3: The shortlist, and a threshold that could not be saved

**Author:** main

### What I did

Measured what size of shortlist keeps the answer reachable, and re-measured the merge bar.

### What worked

```
limit  right entry in shortlist  unrelated questions shortlisted
    5  9/10                      3/7
    8  9/10                      3/7
   10  10/10                     3/7
   15  10/10                     3/7
```

At twenty-four entries the right entry for one question ranks *ninth*, so a shortlist of five loses it and the judge never sees it. Ten recovers everything, and costs nothing in noise — the same three unrelated questions are shortlisted at five as at fifteen. The limit is now ten, with the measurement written beside it.

That property — iteration 19's `miss = 0` — is the one the whole arrangement rests on, and it had quietly stopped holding.

Then the final measurement, with the corpus doubled and no lexical decision anywhere:

```
Questions the knowledge base answers (10):
  rescued by the judge       : 10
  wrong entry chosen         : 0
  declined, so pays to derive: 0
Questions it does not (7):
  never reached the judge    : 4
  correctly declined         : 3
  ANSWERED WRONGLY           : 0
```

Ten of ten, none wrong, on the corpus where deciding by word-counting got two wrong.

### What didn't work

The merge threshold cannot be saved, and this is the more interesting failure.

```
0.885  FLAGGING: flagging-an-answer-as-wrong / telling-the-bot-an-answer-is-wrong
0.500  STALE:    refreshing-a-stored-answer  / what-happens-when-a-stored-answer
0.400  NO_ANSWER: answering-a-question       / what-happens-when-no-stored-answer
0.317  (not duplicates)
0.239  STALE:    refreshing-a-stored-answer  / noticing-when-the-code-behind
0.182  STALE:    what-happens-when-a-stored  / noticing-when-the-code-behind
```

Five pairs describe the same behaviour and score from 0.182 to 0.885. The most alike pair that is *not* the same behaviour scores 0.317. The distributions overlap, so there is no threshold that catches every duplicate without merging entries that are merely neighbours.

Iteration 22 moved this bar into a gap that existed at twelve entries and does not exist at twenty-four. The bar stays at 0.35 — nothing that is not a duplicate reaches it — but it is now chosen for safety rather than coverage, and its test asserts that rather than a separability that is no longer true.

### What I learned

One judge decision looked wrong and was not. It picked `noticing-when-the-code-behind-a-stored-answer-has-changed.md` for "how does it know an answer went stale?", which my labels did not allow. Reading the entry, its own stored question is "how does the bot know when the code behind an answer has changed?" — it answers the question more directly than either entry I had labelled. The judge was right and the label was stale.

Widening a label to make a test pass is exactly how an evaluation becomes worthless, so it was worth reading the entry before deciding which of us was wrong.

### What was tricky

Holding two opposite conclusions from the same data. The corpus growing made retrieval's thresholds indefensible and the merge threshold unsaveable, but it made the judge look *better* — ten of ten, against eight of ten plus two lexical answers. More entries means worse word statistics and better shortlists at the same time.

### What warrants review

- **Twenty-four entries about two subjects.** Everything above is a measurement at that size, including the shortlist of ten and a merge bar chosen for safety.
- **Near-duplicates now accumulate by design.** Three entries describe staleness and nothing will merge them.
- **`npm run judge-eval` is the only check that covers the decision path**, and it costs money, so it is not in CI.

### Future work

Double it again. Everything in this diary is a number that changed when the corpus did, and the harness to re-measure is committed.
