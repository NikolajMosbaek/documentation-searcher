---
title: Why a reworded question can trigger a fresh, slow answer
keywords: rephrase, reword, same question different words, asked again, why did it start over, why so slow, repeat question, saved answer not reused, instant answer, re-read the codebase, cost per question, paraphrase, duplicate entry, second opinion
derived-from: src/core/index.ts, src/core/knowledgeBase.ts, src/core/retrieval.ts, src/core/judge.ts, src/core/claudeJudge.ts, src/core/followUp.ts, src/core/threadContext.ts, src/core/engine.ts, src/index.ts
fingerprint: 9bcfa2031b8275f5
---

## Questions
- why did asking the same thing in different words make it start over?

## Short answer
Only the exact wording of a question is guaranteed to return a saved answer instantly. A reworded version has to clear a deliberately strict word-matching test, and if it falls short and the quick second opinion declines it, the assistant reads the codebase from scratch again — which is slow and costs about a dollar. That fresh read is usually attached to the existing saved answer afterwards, so both wordings are instant from then on.

## What happens
1. Each saved answer keeps a list of every question wording already known to reach it, and asking in exactly one of those wordings — ignoring capitalisation and punctuation — returns that answer immediately at no cost.
2. A reworded question misses that guarantee, so it falls through to word-based matching against everything already saved.
3. Word matching answers on its own only when the best saved answer scores strongly, when roughly three-quarters of the meaningful words in the question appear somewhere in that answer, and when it scores at least twice as high as the next-best answer.
4. If nothing clears those bars, the shortlist of plausible saved answers is handed to a quick, cheap second opinion that decides whether one of them genuinely answers what was asked.
5. If the second opinion picks one, that saved answer is served and nothing is re-read.
6. If it picks none, the assistant reads the codebase from scratch to derive a fresh answer. This is the slow, roughly one-dollar step that looks like starting over.
7. After the fresh read, if the code has not changed since the original answer was written and the new answer says substantially the same thing, the new wording is attached to the existing saved answer instead of a near-duplicate being created, so either phrasing is instant afterwards.
8. If the fresh answer is not recognised as the same thing, it is saved as a separate entry alongside the original.

## Edge cases
- The strict bars are deliberate: with looser settings, measurement showed reworded questions being served the wrong saved answer, so the design prefers paying for a re-read over confidently answering a question nobody asked.
- Adding extra words to a question lowers the share of its words found in the saved answer, so a longer rewording can miss even when it plainly means the same thing.
- When two saved answers look similarly plausible, neither is served on word matching alone, because neither is clearly ahead of the other.
- The second opinion is instructed to decline when in doubt, on the grounds that a needless re-read is cheaper than a wrong answer — so genuine rephrasings are sometimes re-derived anyway.
- If the second opinion is unavailable or fails, the question is simply re-derived, exactly as it would have been before that step existed.
- When no codebase is configured, the second opinion and the follow-up rewriting are switched off entirely, and a question that misses gets an honest 'not known' rather than a fresh read.
- On a very small collection of saved answers — five or fewer — a question that matches nothing lexically is still shown to the second opinion, because word statistics carry too little signal at that size.
- A rewording that leans on the conversation (using words like 'it' or 'that', or being very short) is first rewritten into a standalone question before any lookup, which can change which saved answer it reaches.
- Even an exact wording match is re-derived if the underlying code has changed since the answer was written; the saved answer is not trusted until re-checked.
- Two phrasings derived either side of a code change never merge, so near-duplicate entries can accumulate over time.
