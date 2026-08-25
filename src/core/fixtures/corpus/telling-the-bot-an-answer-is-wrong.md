---
title: Telling the bot an answer is wrong
keywords: wrong answer, that's wrong, incorrect answer, dispute an answer, correct the bot, flag a bad answer, out of date answer, report wrong information, give feedback, objection, re-check the answer, that's not right, fix an answer, challenge an answer, disagree with the bot
derived-from: src/core/correction.ts, src/core/index.ts, src/core/answer.ts, src/core/threadContext.ts, src/index.ts, README.md, src/core/fixtures/corpus/flagging-an-answer-as-wrong-in-the-conversation.md
fingerprint: e22f7f7cf232634d
---

## Questions
- how do I tell the bot that an answer is wrong?

## Short answer
Reply in the same conversation, straight after the answer, with a plain objection such as "that's wrong", "that is out of date", or "no, that's not how it works". The bot treats that as a dispute about the answer just given, reads the code again from scratch, and replies with what it finds, noting that it re-checked.

## What happens
1. Ask your question in a conversation and get an answer.
2. Reply in that same conversation with a plain objection - for example "that's wrong", "that's not right, we stopped doing that", "this is out of date", "that doesn't sound right", "you're mistaken", "that used to be true", or "no longer true".
3. The bot recognises the message as a dispute about the answer just given rather than as a new question.
4. It takes the question that produced the disputed answer and reads the code again from scratch.
5. Your objection is passed along only as a hint about where to look, together with an explicit instruction that it is not evidence and may itself be mistaken.
6. If the code supports the original answer, the bot is told to say so plainly rather than change its answer to agree with you.
7. The freshly re-read answer replaces the stored entry behind the original answer, so the next person who asks the same thing gets the corrected version.
8. You get the new answer back, prefixed with a short note thanking you and saying the code was read again.

## Edge cases
- The objection acts on the most recent answer in that conversation, so it has to come as a reply after an answer. An objection sent as the very first message of a conversation is treated as an ordinary question.
- The same stored answer is only re-read once every five minutes. Flag it again inside that window and the bot replies that it read the code very recently, does not read it again, and notes that a developer can correct the stored entry directly. That window is shared, so someone else flagging the same answer in another conversation is also covered by it.
- Conversation memory is only kept while the service is running, so after a restart there is no previous answer to dispute and an objection is read as a new question.
- Recognition is deliberately cautious and based on phrasing: it prefers to miss a genuine objection rather than mistake a normal question for one. Something worded unusually may simply be answered as a new question, and asking something like "how do I correct an entry?" is treated as a question, not a dispute.
- A bare "no", "nope", "wrong", or "not quite" only counts as an objection when it is the whole message on its own.
- The objection is never accepted as fact. The bot may re-read the code and stand by its original answer, which is the intended outcome when the objection is mistaken.
- Saying why you think it is wrong, such as "that's wrong, we retry six times", gives the bot a more useful pointer for where to look.
- If the code cannot be read again at that moment, the bot says it could not re-check, leaves the answer as it was, and invites you to flag it again in a little while.
- If the disputed answer had no stored entry behind it, the re-read result is stored as a new entry instead of replacing one.
- When an entry is replaced, the question it was originally created under is preserved, so whoever first asked that question still finds it.
- Flagging requires a codebase to be configured for the install; without one the bot cannot re-read and the re-check will fail.
- Each flag costs a full read of the codebase, which is the expensive part of the product, so repeated disagreement adds up.
