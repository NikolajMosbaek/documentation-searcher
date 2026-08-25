---
title: What an answer from the bot looks like
keywords: answer format, what does an answer look like, reply layout, short answer, what happens, edge cases, response structure, formatting, headings, numbered steps, bullet points, out of date warning, no answer message, re-read note
derived-from: src/core/answer.ts, src/core/answerFormat.test.ts, src/index.ts, src/core/engine.ts, src/core/correction.ts, knowledge-base/trial-expiry.md, src/core/index.ts, src/core/knowledgeBase.ts, src/core/claudeEngine.ts
fingerprint: 40a29b9879e1e6df
---

## Questions
- what does an answer from the bot actually look like?

## Short answer
Every reply uses the same three-part layout: a bold "Short answer" line, a numbered "What happens" list, and a bulleted "Edge cases" list. Some replies also carry a short italic note above that, warning the answer may be out of date or saying the code was read again after someone disputed it.

## What happens
1. The asker sends a question in the chat thread and immediately sees a typing indicator while the answer is prepared.
2. The reply opens with a bold heading reading "Short answer", followed by a direct answer of one or two sentences.
3. If there are steps to describe, a bold heading reading "What happens" follows, with the steps as a numbered list in order.
4. If there are conditions or exceptions, a bold heading reading "Edge cases" follows, with each one on its own bullet point.
5. The chat channel sends this text exactly as composed; it adds nothing of its own and does not reorder or restyle anything.

## Edge cases
- When a stored answer describes code that has since changed and could not be checked again, an italic note appears above everything else saying the answer may be out of date; the answer itself is still shown in full rather than withheld.
- When someone says the previous answer was wrong and the code was read again, an italic note appears above the answer saying thanks and that the code was read again; the answer below it is the fresh one.
- Only a genuinely out-of-date answer carries the out-of-date warning; no other kind of reply does.
- When nothing known covers the question, the reply is just the short answer line saying there is no answer yet and that it will not be guessed at, with no steps, no edge cases and no warning note.
- When someone disputes an answer whose code was read again very recently, the reply is a single short answer line explaining that it was not read again and that a developer can correct the stored entry directly.
- When someone disputes an answer but the code could not be read again just then, the reply is a single short answer line saying so and inviting them to flag it again shortly.
- Steps and edge cases are dropped entirely when empty, so a short answer on its own is a valid complete reply.
- Answers are written in plain product language: file names, function names and code snippets are deliberately kept out, and stored entries containing them are flagged when they are loaded rather than reaching an asker.
- Where an answer came from is tracked internally but never appears in the text sent to the asker.
