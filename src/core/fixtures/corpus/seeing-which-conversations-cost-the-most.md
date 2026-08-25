---
title: Seeing which conversations cost the most
keywords: cost per conversation, spend attribution, who is spending the money, expensive conversations, spend log, running total, cost breakdown, budget, dollars per question, most expensive thread, usage reporting, chargeback, why is the bill so high
derived-from: src/core/index.ts, src/index.ts, src/soak.ts, src/core/core.test.ts, src/core/claudeEngine.ts, src/core/claudeJudge.ts, src/core/claudeResolver.ts, README.md, docs/diary/2026-08-25-iteration-15-spend-attribution.md
fingerprint: ec6f4544321fc400
---

## Questions
- which conversations are running up the most cost?

## Short answer
Every time the assistant has to read the codebase to answer something, that cost is charged to the conversation that caused it, and a breakdown lists each conversation that has spent money, most expensive first, with the amount and the number of reads it took.

## What happens
1. A question that can be served from an already-stored answer costs nothing and is not recorded against any conversation.
2. When the assistant has to read the codebase to answer, the cost of that read is added both to a session-wide total and to a separate running total for the conversation it came from.
3. Each read is announced as it happens, showing what it cost, why the read was needed, which conversation caused it, that conversation's running total so far, the session total, and the question that was asked.
4. There are exactly three reasons a read is charged: nothing stored covered the question, a stored answer had to be worked out again because the code behind it changed, or someone flagged an answer as wrong and the code was read again.
5. A breakdown can be requested listing every conversation that has cost money, with its total spend and how many codebase reads it took, sorted from most expensive to least.
6. The number of reads is reported alongside the money because they answer different questions: one costly read means a hard question, while several reads in one conversation usually means someone disputing the answers.
7. A conversation that never triggered a paid read does not appear in the breakdown at all - not as a zero, but absent - so the list contains only conversations that actually cost something.
8. The per-conversation amounts always add up exactly to the session total.

## Edge cases
- A read that finds nothing and produces no answer still costs money and is still charged to the conversation; the log marks it as having produced no answer.
- When someone flags an answer as wrong, the cost is charged to the conversation where the objection was raised, which may not be the conversation that originally asked the question.
- Repeatedly flagging the same answer as wrong within a short window does not trigger another paid read, so it adds nothing to the conversation's cost.
- The cheap supporting steps - rewriting a follow-up question so it stands alone, and second-guessing whether a near-matching stored answer really fits - cost a few cents each but are not included in the per-conversation figures, so the reported amount slightly understates the true spend.
- All the totals are held only for as long as the service keeps running; a restart forgets them, and two copies of the service running at once do not share them.
- The breakdown is currently only reachable programmatically and is not surfaced anywhere an operator would see it; in practice they read the printed lines instead.
- Reading the breakdown hands out copies, so whoever reads it cannot accidentally corrupt the running totals.
- The conversation identifier is opaque but not anonymous - anyone with access to the chat system can trace it to a person - and the printed lines include the questions people typed, so the logs deserve the same care as the conversations themselves.
- Reading a large codebase costs more than the measured figures, which were taken against a small project; the only limit is a configurable ceiling on what a single read may spend.
