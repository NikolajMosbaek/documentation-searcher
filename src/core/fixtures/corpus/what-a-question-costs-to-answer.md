---
title: What a question costs to answer
keywords: cost per question, how much does a question cost, price, spend, budget, billing, dollars, expensive, cheap, free answers, cost of a new question, running total, spend tracking, cost ceiling, per-conversation cost, how much money, cost savings, second time free
derived-from: README.md, src/core/index.ts, src/core/engine.ts, src/core/seeding.ts, src/seed.ts, src/index.ts, docs/diary/2026-08-25-iteration-9-knowing-what-it-costs.md
fingerprint: 526988a02b3188cb
---

## Questions
- how much does it cost when someone asks the bot a question?

## Short answer
A brand-new question nobody has asked before costs roughly 60 cents to a dollar fifteen and takes about 80 seconds, because the bot has to go and read the codebase to work it out. The very same question asked again is free and instant, and the same question in different words costs a fraction of a cent and about four seconds.

## What happens
1. When a question arrives, the bot first checks whether it leans on the earlier conversation. If it does, one quick rewrite makes it stand on its own, adding about four to six seconds and a fraction of a cent.
2. The stored answers are searched. If the question matches one asked before word for word, the stored answer comes back immediately and nothing is spent.
3. If nothing matches exactly but something looks close, a second opinion decides whether a stored answer genuinely covers the question. That takes around four seconds and costs a fraction of a cent.
4. If a stored answer is chosen and the code behind it has not changed, it is handed over with no further cost.
5. If nothing stored covers the question, the bot reads the codebase to work the answer out. This is the expensive path: roughly 80 seconds and between 60 cents and a dollar fifteen.
6. The answer worked out that way is saved, so the next person who asks the same thing pays nothing.
7. Every read of the codebase is logged with what it cost, why it happened, which conversation caused it, a running total for that conversation, and a running total for the whole session.
8. Totals are also available broken down per conversation, most expensive first, so it is possible to see which conversations are driving the spend.

## Edge cases
- A question the codebase genuinely cannot answer costs exactly the same as one it can, because the reading work happens either way. Those are marked in the log as having produced no answer.
- If the code behind a stored answer has changed since it was written, the answer is worked out again from scratch before being handed over, at full price.
- Telling the bot an answer is wrong makes it read the code again, at full price. To stop repeated objections running up charges, the same answer is not re-read more than once in a five-minute window; within that window the asker is simply told it was just checked.
- There is a ceiling on what working out a single answer may cost, set to five dollars out of the box. Lowering it below about a dollar fifty starts cutting off real questions before they are answered.
- The 60 cent to a dollar fifteen range was measured against a small, heavily commented codebase. A larger or less well documented codebase will read more and cost more, and the ceiling is the only thing bounding that.
- With no codebase configured, gaps are never filled, so nothing is ever spent on reading code.
- The few-seconds delay on rewording and near-miss questions is fixed overhead per request rather than anything to do with the size of the question, so it cannot be reduced by asking something simpler.
- The spend log goes to the standard output stream and includes the question as it was typed. It is a log line for someone watching the process, not an audit trail.
