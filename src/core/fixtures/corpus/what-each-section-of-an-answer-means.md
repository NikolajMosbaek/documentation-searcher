---
title: What each section of an answer means
keywords: answer sections, short answer, what happens, edge cases, answer structure, reply layout, what does each part mean, numbered steps, bullet list, out of date note, answer format, sections explained
derived-from: src/core/answer.ts, src/core/answerFormat.test.ts, src/core/knowledgeBase.ts, src/core/claudeEngine.ts, src/core/fixtures/corpus/what-an-answer-from-the-bot-looks-like.md, knowledge-base/trial-expiry.md, PRD.md
fingerprint: 7e1cb8072160973a
---

## Questions
- what do the different sections of an answer mean?

## Short answer
Every reply has up to three parts: a short answer giving the direct response in one or two sentences, a numbered "what happens" list walking through the behaviour in order, and a bulleted "edge cases" list of the conditions and exceptions that change it. Some replies also carry a short italic note above all of that.

## What happens
1. The reply opens with a bold heading reading "Short answer", followed by a direct answer to the question in one or two sentences. It is the whole answer in miniature, and the only part that always appears.
2. If there are steps to describe, a bold heading reading "What happens" follows, listing the behaviour as numbered steps in the order they actually occur. This is the walk-through of how the feature behaves.
3. If there are conditions or exceptions, a bold heading reading "Edge cases" follows, with each one on its own bullet. These are the situations that change the behaviour, such as something being missing, someone acting early, or a step failing, and they are kept separate so a tester can lift test cases straight from them.
4. The chat channel sends this text exactly as composed; nothing is added, reordered or restyled on the way out.

## Edge cases
- An italic note can appear above everything else saying the answer may be out of date. It means the code behind a stored answer changed since the answer was written and could not be checked again just then; the answer is still shown in full rather than withheld.
- A different italic note can appear saying thanks and that the code was read again. It means someone said the previous answer was wrong, and the answer below the note is the freshly derived one.
- Only a genuinely out-of-date answer carries the out-of-date warning; no other kind of reply does.
- The steps list and the edge cases list are dropped entirely when there is nothing to put in them, so a short answer on its own is a complete, valid reply.
- When nothing known covers the question, the reply is only the short answer line saying there is no answer yet and that it will not be guessed at.
- When someone disputes an answer whose code was read very recently, the reply is a single short answer line explaining it was not read again and that a developer can correct the stored entry directly.
- When someone disputes an answer but the code could not be read again just then, the reply is a single short answer line saying so and inviting them to flag it again shortly.
- All three sections are written in plain product language: file names, function names and code snippets are deliberately kept out, and stored entries containing them are flagged when loaded rather than reaching an asker.
- Where an answer came from is tracked internally but never appears in the text sent to the asker.
