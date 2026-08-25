---
title: Conversation memory is lost when the bot restarts
keywords: restart, reboot, redeploy, conversation memory, thread history, does it remember, follow-up after restart, persistence, session, context lost, in-memory, saved answers survive, start from scratch
derived-from: src/core/threadContext.ts, src/index.ts, src/core/index.ts, src/core/followUp.ts, src/core/correction.ts, src/core/engine.ts, src/core/knowledgeBase.ts
fingerprint: 20702c50d5f66321
---

## Questions
- does it still remember my thread after the bot restarts?

## Short answer
No. The bot holds each conversation's history only while it is running, so a restart wipes all thread history and every conversation begins again from nothing. The answers it has already worked out and saved do survive the restart.

## What happens
1. While the bot is running, it records each exchange in a conversation: what was asked, what the question was taken to mean, where the answer came from, and which saved answer was used.
2. It keeps that history separately per conversation, so two different chats never see each other's history.
3. It uses that history for two things: rewriting a follow-up question into one that stands on its own, and recognising when someone is challenging the answer just given rather than asking something new.
4. When the bot restarts, all of that recorded history disappears. Every conversation is treated as brand new, even one that was mid-flow moments earlier.
5. After a restart, the first message in any conversation is handled as a standalone question: it is never rewritten against earlier turns, and it is never treated as a challenge to a previous answer.
6. Answers the bot has already derived and saved are kept as files and are reloaded when it starts up again, so previously answered questions are still answered instantly and for free after a restart.

## Edge cases
- A follow-up sent as the first message after a restart, such as one that only says "and what about that?", is taken completely literally, because there is no earlier turn to resolve it against.
- Saying "that's wrong" as the first message after a restart is treated as an ordinary question instead of a challenge, since there is no previous answer on record to re-check.
- The running total of what the bot has spent reading the codebase, including the per-conversation breakdown, is also held only while it runs and resets to zero on restart.
- The short quiet period that stops the same answer being re-checked over and over after a challenge is also forgotten on restart, so an answer challenged just before a restart can be re-read again immediately afterwards.
- Saved answers are only reloaded if the folder holding them is the same one after the restart; the location is set at startup.
