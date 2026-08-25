---
title: How much conversation history the bot keeps
keywords: conversation memory, chat history, how many turns remembered, follow-up context, does it remember what i asked, thread memory, context window, previous questions, restart loses history, per-conversation history, pronoun resolution, short-term memory
derived-from: src/core/threadContext.ts, src/core/followUp.ts, src/core/claudeResolver.ts, src/core/index.ts, src/index.ts, src/core/correction.ts
fingerprint: b5772b316c7f6e22
---

## Questions
- how much of the earlier conversation does the bot remember?

## Short answer
The bot keeps a per-conversation history of the questions asked (not the answers), held only while the service is running. When working out what a follow-up refers to, it looks at the six most recent earlier questions; flagging an answer as wrong only ever acts on the turn immediately before.

## What happens
1. Each chat or channel is tracked as its own conversation, so history is never shared between separate threads or between different people's chats.
2. After every exchange the bot records what the person typed, the self-contained version of that question, where the answer came from, and which saved entry answered it.
3. The answer text itself is not kept in the conversation history — only questions and where they were answered from.
4. When a new message looks like it depends on the conversation, the bot first rewrites it into a question that stands on its own.
5. That rewrite is shown the six most recent earlier questions from the same conversation, in order, alongside the new message.
6. It is shown the already-resolved form of those earlier questions rather than the raw text, so a run of follow-ups keeps pointing at the right thing instead of drifting one step at a time.
7. When someone flags an answer as wrong, the bot acts on the question from the turn immediately before and on the saved entry that answered it; earlier turns are not considered.
8. All of this is held in the running service's memory, so it is lost on restart. Saved answers are unaffected because those are kept as files.

## Edge cases
- The first question in a conversation is never rewritten, because there is nothing to lean on.
- A question that already reads as self-contained is not rewritten either, so the history is effectively unused for that turn.
- A follow-up that refers back further than the six most recent questions may not be understood, because the older turns are not shown to the rewrite.
- If no codebase is configured, follow-up rewriting is switched off entirely and every question is taken exactly as typed.
- If the rewrite fails, errors, or runs past its spending limit, the question is passed through as asked rather than the turn failing.
- Restarting the service wipes all conversation memory, so a follow-up sent after a restart is treated as a standalone question.
- Older turns are never discarded from the record, but only the six most recent are ever used for resolving a follow-up.
- A message that reads as a complaint about the previous answer is treated as a dispute rather than a new question, and re-uses the previous turn's question instead of being rewritten.
