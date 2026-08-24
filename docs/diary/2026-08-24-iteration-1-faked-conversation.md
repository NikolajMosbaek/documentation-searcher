# Diary: Bootstrap Documentation Searcher through iteration 1

Greenfield start. The goal for the session was to take a raw idea — "have a conversation with a codebase" from Microsoft Teams — through a PRD, a constitution, and the first runnable iteration. Nothing existed at the start but an empty directory; by the end there is a Teams agent that answers questions from a file-based knowledge base, with the codebase-analysis engine deliberately stubbed out.

## Step 1: Interview to a PRD

**Author:** main

### Prompt Context

**Verbatim prompt:** `/clarify-prd`, followed by: "I want to build a documentation searcher. My idea is an AI (Claude Code or Codex) can be used to answers questions about a code base, where you can "have a conversation with a code base". That means anyone can ask about behaviour and get structured answers that is easy to understand. The idea is that the codebase must have a documentation layer that it always searches first to answer questions. If the answer cannot be found it will search through the codebase, update the documentation and give the answer. This means that the documentation can be maintained both by the documentation-searcher AI and the developers. For the UI I the ideal situtation was a plugin for Teams, but it can also be a simple CLI"

**Interpretation:** Run the clarify-prd interview: sharpen the problem and the solution until a specific PRD could be written without guessing, then get approval before writing anything.

**Inferred intent:** The vision was already coherent in the user's head. What it lacked was the specificity that makes it buildable — and, more importantly, the decisions the vision quietly left open.

### What I did

Opened on the vision, then worked through the why and the what one question at a time. Ranked the costs of the current situation, established that the documentation layer is an AI-first knowledge base rather than human-first prose, settled staleness handling, scoped the deployment to one codebase per install, fixed the answer shape, established how developers maintain the knowledge base, and chose cold-start behaviour. Summarised the intended PRD, got approval, and wrote `/PRD.md`.

### Why

The vision named a mechanism (docs first, fall back to code, write back) but left the decisions that determine whether the product works at all: what happens when a stored answer goes stale, who is served first, and what an answer actually looks like. Each of those had to be pinned before a PRD could be specific rather than aspirational.

### What worked

Offering concrete alternatives rather than open questions. The staleness question in particular — verify-on-read versus invalidate-on-change versus trust-until-corrected versus periodic rebuild — got a decision in one exchange, where "how should staleness work?" would have got a shrug. The preview-based answer-shape question worked the same way: seeing three rendered answers side by side made the choice obvious in a way describing them would not have.

Pushing back on the CLI was the highest-value moment in the interview. The user's original vision offered "Teams plugin ideally, or a simple CLI" as if they were interchangeable. They are not: the stated problem is that POs and testers have to route through a developer, and a CLI only serves people who already have a checkout and a terminal — precisely the developers being removed from the loop. Naming that flipped the answer from "CLI first, Teams later" to "Teams from the start."

### What didn't work

Nothing failed outright, but one question was constructed badly. When asked what to record as out of scope, the user selected two of four options — leaving "writing or changing code" and "access control" unselected. Not selecting something is not the same as declaring it in scope, and I had no read on which was meant. That needed a follow-up question to resolve (answer: both undecided, recorded as open questions). A better-framed question would have offered in-scope, out-of-scope, and undecided as explicit choices rather than forcing a binary.

### What I learned

The user ranked developer interruption, blocked askers, and answers never being captured as the costs that hurt — and explicitly did *not* rank "answers can't be trusted." That single non-selection shaped the whole PRD: it is why answers carry no code references for the asker to verify against, and why verification was recorded as a deliberate deprioritisation with a revisit trigger rather than quietly omitted.

### What was tricky

The PRD template forbids file paths and tech-stack choices, but "the knowledge base is version-controlled and lives alongside the code" is genuinely a product requirement, not an implementation detail — a developer being able to review a knowledge-base edit in a pull request is user-facing behaviour. Recording it as a behaviour without naming a path took some care.

### What warrants review

The **Further Notes** section of `/PRD.md` is where I added reasoning rather than transcribing confirmed facts. Two open questions are recorded there, and the verification deprioritisation is written up with a revisit condition. If any of that overstates what was actually decided, that section is where to look.

### Future work

The two open questions — whether the bot may propose code changes, and whether access control is needed — will have to be resolved before they turn into architecture by default.

## Step 2: Interview to a constitution

**Author:** main

### Prompt Context

**Verbatim prompt:** `/clarify-constitution`, followed by: "I don't know. What would you recommend?"

**Interpretation:** The user had no language preference and wanted a recommendation with reasoning, not a menu of options.

**Inferred intent:** Get the durable technical decisions locked so later iterations do not relitigate them — but get them *right*, since a constitution is by definition not revisited mid-project.

### What I did

Rather than answer from memory, loaded the `claude-api` skill to establish what the Claude Agent SDK actually supports, then searched Microsoft Learn for the current Teams bot library. Recommended TypeScript, presented the proposed constitution for approval, and on approval verified the Teams package name before writing `/CONSTITUTION.md`.

### Why

The recommendation hinged entirely on a fact I was not certain of — which languages the Claude Agent SDK supports. Getting that wrong would have locked the project into the wrong language in a document explicitly meant never to change. This was exactly the case for verifying rather than recalling.

### What worked

Verifying first. The Claude Agent SDK ships in TypeScript and Python only — there is **no C# Agent SDK**. C# has the plain Messages API SDK and beta Managed Agents, but not the Claude Code harness with its built-in Read/Grep/Glob/Bash tools. Since that harness is most of this product, the gap is decisive, and it is the entire reason for recommending against C# in what appears to be a Microsoft/Azure DevOps shop. Stating that tension out loud rather than quietly routing around it seemed the honest way to make the recommendation.

The Microsoft Learn search then returned something better than the package name I was after: Microsoft has **deprecated their own `@microsoft/teams.ai` packages** (`ChatPrompt`, `Model`, `@microsoft/teams.mcp`, `@microsoft/teams.a2a`) in favour of bringing your own AI framework and keeping the Teams SDK agnostic to the intelligence layer. That is precisely the adapter/core split the constitution was about to mandate — so a principle that would have been my recommendation is instead Microsoft's documented direction. It went into the constitution as an explicit "do not wire this path," which is more useful to a future agent than the principle alone.

### What didn't work

Nothing failed. Both verification passes returned clean, usable answers on the first attempt.

### What I learned

Teams SDK is GA for TypeScript and C# but only **public preview** for Python, which independently confirms the TypeScript-over-Python call on the Teams side — I had assumed Python's Teams story was weak but did not know it was pre-GA. Also learned that `teams app create` provisions a Teams-managed bot by default with no Azure subscription required, which is what makes deferring infrastructure realistic rather than aspirational.

### What was tricky

Balancing the constitution's "scannable in 10 seconds" rule against genuinely load-bearing detail. The `@microsoft/teams.ai` exclusion needed its rationale to survive — a bare "don't use this" invites a future agent to override it — so it is a short paragraph under Fixed Dependencies rather than a bullet.

### What warrants review

`/CONSTITUTION.md` pins the Claude Agent SDK as the engine while requiring it sit behind an interface. If that interface turns out to leak Agent-SDK-shaped concepts into the core, the principle is not being honoured and the constitution should be read as violated.

### Future work

Nothing pinned the Teams SDK major version. `@microsoft/teams.apps` resolved to `^2.0.15` at install time; if v3 changes the `App` surface, the constitution says nothing about it.

## Step 3: Iteration 1 — the conversation, faked end to end

**Author:** main

### Prompt Context

**Verbatim prompt:** `/suggest-next-iteration`, then the iteration choice ("Faked chat in DevTools"), then: "Go"

**Interpretation:** Propose two or three candidate iterations, let the user pick, then build the chosen one.

**Inferred intent:** Get something running that can be looked at and reacted to, cheaply enough to throw away if the shape is wrong.

### What I did

Proposed three iterations — faked chat, real engine without a chat surface, or a thin slice with both real — and named the tension between them: option A gets the shape right but fakes away the product's central risk, while option B attacks the risk with nothing to look at. The user chose A.

Built it: `/package.json`, `/tsconfig.json`, `/.gitignore`, `/src/index.ts` (the Teams adapter), `/src/core/index.ts` (`createCore`, `ask`), `/src/core/answer.ts` (the `Answer` shape, the markdown formatter, the no-code-references guard), `/src/core/knowledgeBase.ts` (entry parsing and keyword lookup), `/src/core/engine.ts` (the `AnalysisEngine` interface and its stub), `/src/core/threadContext.ts` (in-memory conversation memory), three markdown entries under `/knowledge-base/`, and `/README.md`.

Rather than pin dependency versions from memory, wrote `package.json` with no dependency block and let `npm install @microsoft/teams.apps` and `npm install -D typescript tsx @types/node` resolve them. This produced `@microsoft/teams.apps@^2.0.15`, `typescript@^7.0.2`, `@types/node@^26.3.0`, and `tsx@^4.23.12`.

Verified three ways: a core-level script exercising a hit, a miss, and a follow-up; an over-the-wire test that POSTed real message activities at the running agent and captured what it sent back; and a deliberately bad knowledge-base entry to prove the product-language guard fires.

### Why

The stated success criteria were behavioural — a seeded question answers, an unknown question misses honestly, a follow-up carries context. A typecheck proves none of those. Each had to be executed.

### What worked

Both parts of the verification found real problems, which is the argument for doing it.

The over-the-wire test proved the whole path: typing indicator, then the structured answer, then a clean miss on the second question. Standing up a throwaway HTTP listener as a fake `serviceUrl` was what made this observable at all.

The `findCodeReferences` guard caught both planted violations in the bad entry — the file path `billing/subscription.ts` and the call `renewalJob.run()` — and warned without blocking the load, which is the right severity for something a developer may have written deliberately.

### What didn't work

Four failures, three of them mine rather than the code's.

**The iteration plan I proposed was wrong before I wrote a line.** I told the user the plan used Teams DevTools for a local chat surface. Checking Microsoft Learn during the build returned: "Deprecated — DevTools is deprecated and will be removed in a later version. Use the Microsoft 365 Agents Playground for local testing." The Playground is a standalone CLI (`npm install -g @microsoft/m365agentsplayground`, then `agentsplayground -e http://localhost:3978/api/messages -c emulator`), not an in-code plugin. The setup I had described would not have worked.

**A deprecated option straight out of the current docs.** Microsoft Learn documents `new App({ skipAuth: true })` for local runs. The installed package disagreed at startup:

```
[WARN] @teams/app [DEPRECATED] skipAuth is deprecated. Use dangerouslyAllowUnauthenticatedRequests instead.
```

Replaced it in `/src/index.ts`; the warning is gone and the typecheck still passes.

**A scratchpad test file that would not run.** Writing the smoke test outside the project directory meant it did not inherit `"type": "module"` from `package.json`, so esbuild treated it as CommonJS:

```
ERROR: Top-level await is currently not supported with the "cjs" output format
  code: 'ERR_REQUIRE_ASYNC_MODULE'
```

Renaming `smoke.ts` to `smoke.mts` fixed it. The same trap bit a second time in a worse way — `npx tsx -e "import { loadKnowledgeBase } from './src/core/index.js'; ..."` runs eval as CommonJS and failed with `Error: Cannot find module './src/core/index.js'`. That command was chained as `npx tsx -e "..." ; rm knowledge-base/_leaky.md`, so the cleanup ran regardless of the failure and deleted the test fixture before the assertion had executed. The test had to be rebuilt from scratch as a `.mts` file.

**A verification that silently proved nothing.** The first capture attempt returned no bot replies at all and no error — the run looked clean and was worthless. The cause was my own wait loop: I had polled with `curl -m 1` against a closed port, which returns instantly, so the "wait" took no measurable time and `pkill` killed both processes before the agent's asynchronous reply was sent. Foreground `sleep` is unavailable in this environment, so the fix was `node -e "setTimeout(()=>{},3000)"`. With a real delay the replies appeared immediately.

### What I learned

**Bot Framework replies are out-of-band.** The agent does not answer on the HTTP response to `/api/messages`; it POSTs its reply to the `serviceUrl` carried in the inbound activity. A `curl` at the endpoint can therefore only ever show you an acknowledgement, never the answer. Any future attempt to verify answer text over HTTP needs a listener at `serviceUrl` — which also explains the first probe returning `http_status=500` with `connect ECONNREFUSED ::1:9999`: that error was the agent trying to deliver a reply to a port with nothing on it, and was evidence the handler had run, not evidence of a bug.

**Microsoft Learn lags the shipped package.** Two independent cases in one session — DevTools and `skipAuth`. Treat the docs as directionally right and the installed package as authoritative.

**Letting npm resolve versions beats writing them.** It also surfaced that this environment installs TypeScript 7 and `@types/node` 26, neither of which I would have guessed.

### What was tricky

Verifying an asynchronous, out-of-band reply inside a single shell invocation. It required a fake `serviceUrl` listener, a real delay, and enough process discipline to not kill either side early — and the failure mode when any of that is wrong is a clean-looking run that proves nothing. That is a far more dangerous failure than a crash, and it is worth distrusting any future "verification" here that passes without showing captured output.

### What warrants review

- **`/src/core/answer.ts`** — the `CODE_SHAPED` pattern `/:\d{1,5}\b/` is meant to catch line numbers like `subscription.ts:142`, but it will also fire on a legitimate clock time such as "charged at 09:00". No current entry trips it, but it is a false-positive waiting to happen and the guard's value depends on developers not learning to ignore it.
- **`/src/core/index.ts`** — `ask` takes a `ThreadContext` and immediately does `void thread`. The parameter is threaded through so follow-ups have a seam to resolve against, but nothing reads it yet. Worth confirming this is the right seam rather than a placeholder that will need reshaping.
- **`/src/index.ts`** — `dangerouslyAllowUnauthenticatedRequests` is gated on `process.env.NODE_ENV !== 'production'`. That default fails open: anything deploying this without setting `NODE_ENV=production` accepts unauthenticated requests on `/api/messages`. Given the name of the option, an explicit opt-in flag might be safer than an environment-inferred one.
- **`/src/core/knowledgeBase.ts`** — `parseEntry` throws on a missing frontmatter block or a missing `## Short answer`, so one malformed entry takes down startup for the whole knowledge base. Fine now with three hand-written files; hostile once the bot is writing them itself.
- **`findEntry`** counts keyword substring matches and is not retrieval. It is meant to be replaced, not improved.

### Future work

Falling directly out of this iteration: the real `AnalysisEngine` backed by the Claude Agent SDK, and actual retrieval behind `findEntry`. Still untouched from the PRD: verify-on-read staleness checking, guided seeding, in-thread correction, and real Teams registration. Nothing in the code has been run inside an actual Teams client yet — only against the protocol.
