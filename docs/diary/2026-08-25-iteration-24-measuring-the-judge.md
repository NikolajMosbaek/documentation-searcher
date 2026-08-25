# Diary: Iteration 24 — measuring the thing that decides

Since iteration 19, retrieval shortlists and a model decides. That model's accuracy had been described in iteration 8 as "illustrated, not measured", against five questions and three entries. It is now the component most answers pass through, and it had never been tested at any scale.

## Step 1: Choosing the iteration

**Author:** main

### Prompt Context

**Verbatim prompt:** `/loop until 5:30 A.M. /suggest-next-iteration always pick recommendation`

**Interpretation:** Twenty-third firing of the self-paced loop. Take the recommendation and build it.

**Inferred intent:** Keep making progress until the window closes.

### What I did

Measured the judge against the labelled set already committed, then made the measurement repeatable.

### Why

Four iterations running, measuring something never measured has found a real defect: the cold-start over-matching, the inert retrieval thresholds, a merge rule that could not fire, a correction path missing more than half of what it exists to catch. This is the last component in that category, and iteration 19 raised the stakes on it — the bars are now high enough that most questions reach the judge rather than being answered outright.

The material was all in place. The corpus was committed in iteration 19, the labelled questions with it, and running them through a real model costs about thirty cents.

### What worked

Sharing the labels. The hermetic evaluation and the live one now read the same `labelledQuestions.ts`, so they are judged against identical claims about which entry answers which question. Two copies would drift, and the interesting comparison is precisely between what retrieval decides and what the judge decides about the same question — which only means anything if "correct" means the same thing to both.

### What didn't work

Nothing failed in this step.

### What I learned

Nothing new.

### What was tricky

Nothing.

### What warrants review

Seventeen questions, one corpus, one model.

### Future work

None from this step.

## Step 2: What the judge scores

**Author:** main

### What I did

Ran all seventeen questions: ten the corpus answers, seven it does not.

### What worked

```
Questions the knowledge base answers (10):
  served by retrieval alone  : 2
  rescued by the judge       : 8
  wrong entry chosen         : 0
  declined, so pays to derive: 0
Questions it does not (7):
  never reached the judge    : 4
  correctly declined         : 3
  ANSWERED WRONGLY           : 0
```

Nothing was answered from an entry that does not answer it, and nothing that could be answered was turned away. Every one of the eight rescues is a question retrieval refused to decide, including "how does it know an answer went stale?" — the case that, before iteration 19, retrieval answered from entirely the wrong entry.

The four that never reached the judge are the useful economy: a question sharing no word with anything costs nothing at all, not even a model call.

### What didn't work

Nothing failed, and that is worth being careful about rather than pleased with. A perfect score on seventeen questions is weak evidence of perfection and reasonable evidence of no systematic failure at this size. The set is small, the corpus is small, both were assembled by me, and the labels are my judgement.

### What I learned

It is a better result than iteration 8's, which measured two rescues of three with one conservative decline on a three-entry corpus and concluded the judge was biased towards refusing. On twelve entries it declined nothing it should have rescued.

The plausible reason is that the shortlist is better: with twelve entries, retrieval hands over five candidates with the right one usually near the top, where with three it handed over whatever there was. The judge is only as good as what it is shown, and iteration 19's `miss = 0` property — that the right entry is always in the shortlist — is what makes its job possible.

That connection was not obvious when the shortlist property was chosen. It was picked because losing the answer would be unrecoverable; it turns out also to be what makes the decision easy.

### What was tricky

Reporting a perfect score without overclaiming. The honest sentence is that no systematic failure is visible at this size, and the numbers are in the README alongside the size of the set that produced them.

### What warrants review

- **Seventeen questions.** A perfect score here does not mean much on its own.
- **The judge saw shortlists built by the current thresholds.** Change those and this measurement no longer describes the system.

### Future work

None.

## Step 3: Making it repeatable

**Author:** main

### What I did

Committed the harness as `/src/judgeEval.ts`, behind `npm run judge-eval`, and ran the committed version rather than trusting that it matched the scratch one.

### Why

The soak costs two to three dollars, which is enough to make anybody think twice before running it. This costs about thirty cents, which is cheap enough that it might actually be run when the corpus grows or the thresholds move — and those are exactly the moments when the measurement stops being true.

It exits non-zero if anything is answered from an entry that does not answer it, so it can be used as a gate rather than only read.

### What worked

The committed version reproduced the scratch result exactly, and the drift test caught the new fixture module before I had thought about the README — the third consecutive iteration it has done that on a real change rather than a deliberate break.

### What didn't work

Nothing.

### What I learned

There are now three levels of check in this project, and the cost of each determines how often it is run: `npm test` at a second and nothing, `judge-eval` at thirty cents, the soak at two to three dollars. The middle one did not exist an hour ago, and it is the one that covers the component most answers depend on.

### What was tricky

Nothing.

### What warrants review

- **`judge-eval` reads the committed corpus by default**, so it measures the judge against entries about this bot. Pointed at another knowledge base it needs labels for that one, which nothing provides.

### Future work

None.
