---
title: Asking follow-up questions in the same conversation
keywords: follow-up question, follow up, conversation, thread, context, remembers earlier questions, pronouns, short question, shorthand, and what about, why, tell me more, expand on that, conversation memory, repeat the question, earlier question
derived-from: PRD.md, src/core/followUp.ts, src/core/followUp.test.ts, src/core/threadContext.ts, src/core/claudeResolver.ts, src/core/index.ts, src/index.ts, src/core/engine.ts
fingerprint: d5005673e058476e
---

## Questions
- can I ask a follow-up without repeating the whole question?

## Short answer
Yes. Inside the same conversation thread you can ask a short follow-up such as "and if they have no card?" or "why?", and the bot fills in what you left out from your earlier questions in that thread before answering.

## What happens
1. You ask a question in a conversation thread and get an answer.
2. You ask a follow-up in that same thread, phrased however you like — leaning on words such as it, they, that, the same, or simply asking for more of what was just said.
3. The bot first judges whether your message needs the conversation to make sense. A message that clearly stands on its own is passed through untouched, at no extra cost.
4. If it does lean on the conversation, the bot rewrites it into a question that stands on its own, using only your earlier questions in that thread. It keeps your wording and only fills in what you left out — it does not answer at this stage and does not invent detail the conversation never contained.
5. That self-contained version is what everything else works from: looking for an answer already stored, reading the codebase when nothing stored covers it, and writing the new stored entry.
6. You get the answer back in the usual shape: a short direct answer, the behaviour step by step, then the edge cases.
7. The conversation remembers the filled-in version of each question, so a chain of follow-ups keeps working — a later follow-up resolves against the full meaning of the previous one rather than the shorthand you typed.

## Edge cases
- Only within one thread. The same follow-up asked in a fresh conversation has nothing to lean on and is taken literally.
- The very first message in a thread is never rewritten.
- Only the most recent handful of earlier questions in the thread are used — roughly the last six. Anything older is out of reach.
- Only your earlier questions are used to fill in the gaps, not the answers you were given. Asking for more of a specific part of an answer, such as the third step, may still come back thinner than expected.
- The conversation memory is held only while the service is running, so a restart loses the thread history and later follow-ups are treated as standalone questions.
- When no codebase is configured for the install, follow-up rewriting is unavailable and every question is taken exactly as typed.
- If the rewrite cannot be completed, the question is passed through as you asked it rather than failing — you still get an answer, just without the missing context filled in.
- A message that reads as flagging the previous answer as wrong is handled as a correction of that answer, not as a follow-up question.
- The bot deliberately errs towards treating a question as a follow-up. A self-contained question that happens to say it or they will still go through a rewrite, which normally returns it unchanged.
- An empty message is not treated as a follow-up.
