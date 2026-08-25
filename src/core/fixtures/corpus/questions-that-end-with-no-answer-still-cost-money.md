---
title: Questions that end with no answer still cost money
keywords: no answer cost, does a miss cost money, cost of unanswered question, spend tracking, price per question, wasted spend, i don't know reply, billing, budget, how much does a question cost, free versus paid answers, cost reporting, failed lookup charge
derived-from: PRD.md, src/core/index.ts, src/core/engine.ts, src/core/claudeEngine.ts, src/core/answer.ts, src/core/claudeJudge.ts, src/core/claudeResolver.ts, src/seed.ts, src/soak.ts, src/core/seeding.ts, src/index.ts
fingerprint: 10db85cb78522fd0
---

## Questions
- do questions that end with no answer still cost money?

## Short answer
Yes. The cost comes from reading the codebase, not from producing an answer, so a question that ends with "I don't have an answer to that" normally costs the same as one that succeeds, and it is recorded as spend and marked as having produced no answer. The only free no-answer cases are the ones where nothing was actually read.

## What happens
1. A question first goes to the stored answers. If a good stored answer is found and the code behind it has not changed, the reply is immediate and costs nothing.
2. If nothing stored covers the question, the assistant reads the codebase to work the answer out. This read is the expensive step, taking about a minute and costing roughly a dollar.
3. The read is charged whether or not it finds anything. If the assistant reads the code and concludes it does not cover the question, the money is already spent.
4. The asker is told plainly that there is no answer yet and that the assistant will not guess at one.
5. The amount spent is added to a running total for the session and to a separate total for that specific conversation, and the number of reads for that conversation is counted.
6. Each read is logged with its amount, the reason it happened, the conversation it belongs to, and the question asked. Reads that produced no answer are flagged as such, so an unanswered question shows up as spend rather than as nothing.
7. Operators can see the overall total and a per-conversation breakdown, ordered most expensive first.

## Edge cases
- When no codebase is connected to the assistant, every question comes back with no answer and costs nothing, because there is nothing to read.
- When someone flags the same answer as wrong twice in quick succession, the second flag is refused within a short cooling-off window of a few minutes; the asker is told the code was read very recently, and nothing is charged.
- When a stored answer is out of date and the re-read fails, the asker is still given the old answer with a warning that it may be out of date; that failed re-read is still counted as a read of the codebase.
- When someone flags an answer as wrong and the re-read fails, the asker is told the code could not be read again and to try again later; the attempt is still counted as a read.
- When a read is cut short because the service is unreachable or the spending ceiling is hit part-way through, the amount recorded is zero even though work was really done, so the reported total can understate what was actually spent.
- When a read succeeds but the resulting answer is thrown away for mentioning code detail that askers are never shown, the full cost is charged and the asker still gets no answer.
- Rewriting a follow-up question so it stands on its own, and weighing near-miss stored answers before deciding to read the code, are separate small charges of a few cents each. These are not added to the reported total at all, which counts only codebase reads.
- During the initial setup pass, where a batch of questions is answered ahead of time, the same rule applies: questions the code does not answer are charged and reported individually alongside the ones that succeed.
