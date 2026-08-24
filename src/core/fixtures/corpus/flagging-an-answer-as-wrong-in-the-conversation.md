---
title: Flagging an answer as wrong in the conversation
question: how do I tell the bot that an answer is wrong?
keywords: wrong answer, that's wrong, incorrect answer, dispute an answer, correct the bot, flag a bad answer, out of date answer, report wrong information, give feedback, objection, re-check the answer, that's not right, fix an answer
derived-from: src/core/correction.ts, src/core/correction.test.ts, src/core/index.ts, src/core/answer.ts, src/core/threadContext.ts, src/index.ts, README.md
fingerprint: 440da59831ee3e97
---

## Short answer
Reply in the same conversation, straight after the answer, with a plain objection such as "that's wrong", "that is out of date", or "no, that's not how it works". The bot treats that as a dispute, reads the code again, and replies with what it finds, noting that it re-checked.

## What happens
1. Ask your question in a conversation and get an answer.
2. Reply in that same conversation with a plain objection - for example "that's wrong", "that's not right, we stopped doing that", "this is wrong", "that is out of date", "that doesn't match what I see", "no, that is not how it works", or "no longer true since the rewrite".
3. The bot recognises the message as a dispute about the answer just given rather than as a new question.
4. It takes the question that produced the disputed answer and reads the code again from scratch.
5. Your objection is passed along only as a hint about where to look, together with an explicit instruction that it is not evidence and may itself be mistaken.
6. If the code supports the original answer, the bot is told to say so plainly rather than change its answer to agree with you.
7. The freshly re-read answer replaces the stored entry that produced the original answer, so the next person who asks gets the corrected version.
8. You get the new answer back, prefixed with a short note thanking you and saying the code was read again.

## Edge cases
- The objection has to be the reply directly after an answer in the same conversation. If anything else is asked in between, the message is treated as an ordinary new question.
- Conversation memory is only kept while the service is running, so after a restart there is no previous answer to dispute and an objection is read as a new question.
- Recognition is deliberately cautious and phrasing-based: it prefers to miss a genuine objection rather than mistake a normal question for one. Something worded unusually may simply be answered as a new question. Asking "how do I correct an entry?" is treated as a question, not a dispute.
- The objection is never accepted as fact. The bot may re-read the code and stand by its original answer, which is the intended outcome when the objection is mistaken.
- Saying why you think it is wrong, such as "that's wrong, we retry six times", gives the bot a more useful pointer for where to look.
- If the code cannot be read again at that moment, the bot says it could not re-check, leaves the answer as it was, and invites you to flag it again in a little while.
- If the disputed answer had no stored entry behind it, the re-read result is stored as a new entry instead of replacing one.
- When an entry is replaced, the original question it was created under is preserved, so whoever first asked that question still finds it.
- Flagging requires a codebase to be configured for the install; without one the bot cannot re-read and the re-check will fail.
- Nothing limits how often an answer can be flagged, and each flag costs a full re-read of the code, so repeated disagreement is expensive.
