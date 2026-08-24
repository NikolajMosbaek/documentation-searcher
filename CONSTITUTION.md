# Constitution

## Language & Runtime

TypeScript on Node.js 20 or later (the Teams SDK minimum).

## Architecture Principles

- **Thin Teams adapter over a transport-agnostic core.** The core exposes roughly `ask(question, threadContext) → answer`; Teams is one caller of it. The whole product stays testable without a Teams tenant in the loop.
- **The analysis engine sits behind an interface.** The Claude Agent SDK is the engine, but no call site knows that.
- **Answer structure and product-language rules live in the core**, never in the adapter. A second front end must not be able to drift from them.
- **The knowledge base is plain files in the repository.** Not a deferred fake — version-controlled and developer-editable is a product requirement. There is no database, and none is coming.
- **Everything else stays in-memory behind clean interfaces** until a fake genuinely can't cut it: thread context, session state, seeding progress. No queues, no external stores.

## Fixed Dependencies

- `@anthropic-ai/claude-agent-sdk` — the codebase-analysis engine
- `@microsoft/teams.apps` — Microsoft's Teams SDK; the bot surface (`new App()`, message handlers)
- `@microsoft/teams.cli` — Teams Developer CLI, development only (in preview)

**Deliberately excluded:** the `@microsoft/teams.ai` packages (`ChatPrompt`, `Model`, `@microsoft/teams.mcp`, `@microsoft/teams.a2a`). Microsoft has deprecated them in favour of bringing your own AI framework and keeping the Teams SDK agnostic to the intelligence layer — which is exactly the adapter/core split above. Do not wire this path.
