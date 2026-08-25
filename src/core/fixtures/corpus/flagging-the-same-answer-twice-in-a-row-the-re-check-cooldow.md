---
title: Flagging the same answer twice in a row: the re-check cooldown
keywords: flagged twice, flag again, nothing happened, second flag ignored, repeat dispute, cooldown, re-check, read the code again, dispute the same answer, correction ignored, flagged an answer as wrong twice, did not re-read, i read the code very recently
derived-from: src/core/index.ts, src/core/answer.ts, src/core/correction.ts, src/core/correction.test.ts, src/core/core.test.ts, src/core/threadContext.ts, src/index.ts, src/soak.ts, src/core/fixtures/corpus/flagging-an-answer-as-wrong-in-the-conversation.md
fingerprint: 225c342c1599d91c
---

## Questions
- I flagged the same answer twice and the second time nothing happened - why?

## Short answer
Because the answer had just been re-checked. After the bot reads the code again for a flag, it leaves that stored answer alone for five minutes, so a second flag within that window gets a short reply saying it read the code very recently and will not read it again, rather than a fresh re-check.

## What happens
1. You flag an answer as wrong in the conversation, straight after it was given.
2. The bot recognises the objection, reads the whole codebase again for that question, and replies with a freshly derived answer prefixed by a note thanking you and saying it re-read the code.
3. It also updates the stored answer behind it and records the moment it did that re-read.
4. You flag the same answer again in the same conversation.
5. The bot recognises the second message as an objection too, and looks up when that stored answer was last re-read for a flag.
6. Because it was re-read less than five minutes ago, it stops there and does not read the code again.
7. You get a short reply saying it read the code for this one very recently, so it has not read it again, and that the answer is a file in the repository a developer can correct directly.
8. The stored answer is left exactly as the first flag left it, and nothing is charged for the second flag.

## Edge cases
- The quiet window is five minutes from the last real re-read. Flagging again after that does trigger a full fresh re-check.
- The window does not restart when a flag is turned away, so repeated flagging does not push the wait further out - five minutes after the last actual re-read is always enough.
- The window is attached to the stored answer itself, not to you or your conversation. If a colleague flags the same answer in a different conversation within those five minutes, they get the same short reply.
- The limit only applies when there is a stored answer behind what was flagged. If the answer was given without one, the flag causes a fresh read every time.
- Restarting the service clears the memory of recent re-checks, so a flag straight after a restart reads the code again.
- This is a cost control, not a bug: each flag means reading the entire codebase again, which costs real money, so the same answer is not re-derived on repeat.
- If the second message was not clearly worded as an objection, a different thing happens - it is treated as an ordinary new question instead, and the answer you get will be about whatever you appeared to ask.
- An objection also has to be the very next message after the answer. If anything else was asked in between, it is read as a new question rather than a flag.
- The second reply deliberately does not claim the answer is out of date; it only says the code was read recently.
- The five-minute window is fixed in the running service - there is no setting to change or switch it off.
