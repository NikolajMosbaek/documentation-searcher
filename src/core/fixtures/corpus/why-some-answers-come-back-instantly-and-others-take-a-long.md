---
title: Why some answers come back instantly and others take a long time
keywords: slow answer, took a minute, response time, latency, delay, why so slow, instant answer, already answered, first time asked, waiting for a reply, performance, re-reading the code
derived-from: PRD.md, src/index.ts, src/core/index.ts, src/core/knowledgeBase.ts, src/core/retrieval.ts, src/core/engine.ts, src/core/claudeEngine.ts, src/core/followUp.ts, src/core/judge.ts, src/core/answer.ts
fingerprint: 3dabba8576d3e2f7
---

## Questions
- why did my question take almost a minute to answer?

## Short answer
A slow reply means the bot had to read the codebase itself, which happens when no stored answer covers the question, when the code behind a stored answer has changed, or when someone flags an answer as wrong. When a stored answer matches confidently and is still current, the reply comes back immediately.

## What happens
1. The bot shows a typing indicator as soon as the question arrives, so the conversation looks active while it works.
2. If the question is not the first in the thread and appears to lean on what was said earlier, the bot spends a short step rewriting it into a question that stands on its own. A question that already stands alone skips this step.
3. The bot looks in its existing store of answers for one that matches, either by the exact wording used before or by shared vocabulary.
4. When a stored answer matches confidently, the bot checks whether the parts of the codebase that answer was based on have changed since it was written.
5. If nothing has changed, the stored answer is returned straight away. This is the instant case.
6. If the match is close but not confident enough to trust on wording alone, the bot spends a short extra step weighing the shortlisted stored answers to see whether one already answers the question. Slower than an outright match, much faster than reading the code.
7. If no stored answer covers the question, or the code behind the matching one has changed, the bot reads the codebase from scratch to work out the behaviour. This is the long step and accounts for most of the wait.
8. Having read the code, the bot writes what it learned into its store of answers and then replies, so the same question asked again comes back instantly.

## Edge cases
- The first time anyone asks about a given behaviour, the full codebase read is unavoidable; the wait is the price of the answer existing at all afterwards.
- Asking the same thing in different words can still trigger a full read, because a rephrasing may not reach the stored answer. The bot then attaches the new phrasing to the existing answer where it recognises it as the same behaviour.
- A previously fast question can suddenly become slow if the code it describes has changed, because the stored answer is re-derived before being served.
- Flagging an answer as wrong always triggers a fresh read of the codebase, so a correction takes about as long as a first-time question.
- Flagging the same answer again within a few minutes does not trigger another read; the bot replies straight away saying it read the code very recently.
- A long wait can still end in the bot saying it does not know. Reading the code takes the same time whether or not it finds an answer.
- Answers written by hand by a developer are never treated as out of date, so they are always served immediately.
- If the deployment has no codebase attached, every unanswered question returns an immediate honest miss rather than a slow read.
- There is a spending ceiling and a limit on how much the bot will do while reading. If either is hit, it stops and replies without an answer, after having already spent the time.
- When the code has changed but the re-read fails, the stored answer is served with a note that it may be out of date, rather than being withheld.
