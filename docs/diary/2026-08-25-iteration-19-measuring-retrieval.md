# Diary: Iteration 19 — measuring retrieval instead of assuming it

Three separate diaries recorded that the retrieval thresholds had never been tuned against a knowledge base larger than three entries. Measuring them against twelve found something worse than mistuning: on a corpus of that size, deciding on word-counting alone served a wrong answer to roughly a third of the questions asked, and no choice of threshold fixed it.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Eighteenth firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Built an evaluation corpus and measured retrieval against it, rather than adding anything.

### Why

It was the clearest outstanding risk and had been recorded three times without being acted on — in iteration 4, which set the bars and said three entries was too small to set them from; in iteration 17, which found the bars badly wrong at the opposite extreme; and in iteration 18, which measured a margin of two hundredths on one of them.

Three recordings of the same risk is a backlog item; it was time to either measure it or stop mentioning it.

### What worked

Not writing the corpus. Nine of the twelve entries were produced by this bot during live runs across the night — the derivation from iteration 2, the staleness entry from 3, the read-only entry from 6, the seeded entry from 7, the soak entries from 10 and 18, and others. The remaining three are the hand-written billing examples this project ships.

That matters because of a mistake this project has made repeatedly: a fixture written by the same person who wrote the code agrees with it about things reality does not. Iteration 3's fake keywords, iteration 4's fixture vocabulary, iteration 6's ASCII apostrophes. A corpus of real output cannot flatter the retrieval it is used to measure.

It also came free. The entries were sitting in scratch directories and temporary soak workspaces, and would have been deleted with the session.

### What didn't work

Nothing failed in this step.

### What I learned

The corpus contains two pairs of entries that the engine genuinely duplicated — the same question derived on different runs — and a mix of the entry format before and after questions became a list. Both are realistic in a way I would not have thought to construct.

### What was tricky

Nothing.

### What warrants review

**Twelve entries is still not many**, and they are all about two subjects: this bot, and subscription billing. A real knowledge base is broader.

### Future work

None from this step.

## Step 2: What the measurement said

**Author:** main

### What I did

Labelled ten rephrasings — none repeating the wording of the entry that should answer them — and seven questions the corpus has no business answering. Then swept both bars across their plausible ranges.

### Why

Sweeping rather than testing one setting, because the question was "what should these be", not "are these right".

### What worked

The sweep answered a different question than the one asked, which is the most useful thing it could have done:

```
score  cov   correct  wrong  missed  false-positive
0.50  0.20        7      3       0               3
1.00  0.34        7      3       0               2      <- the settings in use
1.50  0.50        7      3       0               2
2.00  0.50        7      3       0               2
```

Every row is the same. Across a fourfold range of score and more than double the coverage, the outcome does not move: three of ten rephrasings served the wrong entry, two of seven unrelated questions were answered, and nothing was ever missed.

`missed = 0` everywhere is the tell. Every question, including "how many people work here?", had a top-ranked entry clearing even the strictest bars tried. The thresholds were not mistuned. They were inert.

The reason is structural: an absolute score grows with the size of the corpus and the rarity of the words in it, so a number chosen against three entries means something else against twelve and something else again against a hundred. There is no value that is correct for all of them.

### What didn't work

Nothing failed, but reading the individual cases showed how close the misses were:

```
how does it know an answer went stale?
   4.10  cov=0.75  what-the-bot-does-when-the-code-reading-service-is-unreachab.md   <- served
   2.63  cov=0.50  what-happens-when-a-stored-answer-is-out-of-date.md               <- correct
   2.54  cov=0.50  refreshing-a-stored-answer-when-the-code-behind-it-has-chang.md   <- also correct
```

The right answers were second and third. Retrieval's *ranking* was nearly right; its *decision* was wrong. And the mechanism built for exactly this — the second opinion from iteration 8 — never ran, because a judge is only asked about candidates that fall short of the bars.

### What I learned

The discriminating signal is not the score, it is the gap. A wrong top-ranked entry beat its runner-up by 1.04x and 1.09x. A right one beat it by 2.2x to 2.6x. Absolute magnitude says how much vocabulary was shared; the margin says whether anything else shares it too, which is the actual question.

### What was tricky

Recognising that a flat sweep is a result rather than a failed experiment. My first reading was that the harness must be broken, because a sweep that changes nothing looks like a sweep that measured nothing. It was measuring correctly, and what it measured was that the parameter does not matter.

### What warrants review

The labelled set is mine, and "acceptable answer" is my judgement for each question. Two of the ten allow either of a duplicate pair.

### Future work

None from this step.

## Step 3: What was changed, and what it costs

**Author:** main

### What I did

Made retrieval a shortlister rather than a decider. An entry is now answered with on word-counting alone only when the evidence is overwhelming: score at least 4.0, at least three quarters of the question accounted for, and at least twice the runner-up's score. Everything else that ranks goes to the judge.

### Why

The measurement:

```
score  cov   margin |  right  WRONG  short  miss |  SERVED-wrongly  short  none
1.00  0.34  1.00  |      7      3      0     0 |               2      1     4
4.00  0.75  2.00  |      2      0      8     0 |               0      3     4
```

No wrong entry served, no unrelated question answered, and — the property the whole arrangement rests on — `miss = 0`: in every case where retrieval declined to answer, the correct entry was still inside the shortlist handed to the judge. Retrieval is allowed to be unsure. It is not allowed to lose the answer.

### What worked

The existing suite absorbed a change to the heart of retrieval with a single genuine failure. One test asserted that a rephrasing is *served*; under the new arrangement it is shortlisted and the judge decides. Rewritten to assert what it was always really protecting — that the right entry is reachable — rather than the mechanism it happened to use.

### What didn't work

A typecheck error made twenty-seven tests fail at once and briefly looked like the change had broken everything. A constant had been deleted along with the block it was declared in. Restoring it took the count to one real failure.

Then my own new test for the margin rule failed, and the fixture was wrong rather than the code: both entries mentioned refunds, so "refund" appeared in every entry, the universal-term rule from iteration 17 zeroed it, and nothing ranked at all. Adding a third, unrelated entry made "refund" discriminating again and produced a genuine coin toss — margin 1.01, neither served, both shortlisted. Measured first, then asserted.

### What I learned

The cost side deserves stating plainly, because it is a real regression for users. Most repeat questions now take a few seconds and a few cents instead of being instant and free, since they are shortlisted rather than served outright. Against that: roughly a third of questions were being answered from an entry that did not answer them, silently, forever, to everyone who asked afterwards. Iteration 4 wrote down that missing is the safe failure and a wrong hit is not. This is that principle costing something for the first time.

### What was tricky

Deciding to make a structural change to retrieval this far into the night, on the evidence of one twelve-entry corpus. What settled it is that the alternative was leaving a measured, reproducible, ~30% wrong-answer rate in place with a note about it.

### What warrants review

- **Three numbers set from one corpus of twelve entries**, about two subjects. They will need measuring again against a real knowledge base, and the harness for doing that is now committed.
- **The judge is now on the critical path for most questions.** If it is unavailable, the fallback is a derivation at a dollar rather than a wrong answer at nothing, which is the right direction but not free.
- **The evaluation asserts my labels.** If a label is wrong the test enforces the wrong thing.

### Future work

Re-run the evaluation against a knowledge base of fifty or more entries. The corpus, the labelled questions and the harness are committed, so it is now a matter of adding entries rather than building anything.
