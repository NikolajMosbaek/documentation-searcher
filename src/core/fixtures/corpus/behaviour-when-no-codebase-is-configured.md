---
title: Behaviour when no codebase is configured
question: What does the bot do when nobody has configured a codebase for it?
keywords: no codebase configured, not pointed at a codebase, missing setup, cannot read the code, degraded mode, answers from stored entries only, startup warning, honest miss, seeding without a codebase, unconfigured install
derived-from: README.md, src/index.ts, src/core/index.ts, src/core/engine.ts, src/core/answer.ts, src/core/followUp.ts, src/core/judge.ts, src/core/sourceIndex.ts, src/seed.ts
fingerprint: d85c457d3c8cf7d1
---

## Short answer
The bot still starts and answers normally from whatever is already stored, but it can never read the code to fill a gap. Anything not already covered gets a plain "I don't have an answer to that yet, and I won't guess at one" reply, and nothing new is written.

## What happens
1. At startup the bot notes once, in its own log, that no codebase is configured and that the setting must be provided before gaps can be filled. It does not refuse to start.
2. It loads the existing stored answers as usual and reports how many it found.
3. When someone asks a question, it looks for a stored answer using its normal word-based lookup.
4. If a stored answer matches, it is served exactly as written, with no attempt to check whether the code behind it has changed since.
5. If nothing matches, it replies that it has no answer yet and will not guess at one, and no new entry is added to what it knows.
6. Because it never reads the code, it spends nothing and its running cost total stays at zero.

## Edge cases
- Stored answers are never flagged as possibly out of date and are never refreshed, because there is nothing to compare them against, so an answer written against code that has since changed is still served as if current.
- Follow-up questions that lean on the conversation are taken literally as typed rather than rewritten to stand on their own, so a short question such as "and how does it know?" will simply miss.
- A question close to something stored but phrased differently gets no second opinion, so near misses that would normally be rescued come back as a plain miss.
- Telling the bot an answer is wrong does not trigger a re-read: it replies that it could not read the code just now, leaves the answer as it was, and invites the person to flag it again later.
- Flagging the same answer twice within a few minutes gets the "I read the code for this one very recently" reply instead, even though no re-read actually happened.
- Hand-written stored answers behave exactly as they would with a codebase configured, since they were never subject to the freshness check anyway.
- The separate command that proposes and writes a starting set of answers refuses to run at all without a codebase, exiting immediately with a message asking for it to be set.
