# Agent Instructions

## Project

This is a NestJS TypeScript service that exposes an Anthropic-compatible Claude Code API and forwards requests to OpenCode Go models.

## Commands

Run checks before claiming work is complete:

```sh
pnpm exec jest --runInBand
pnpm exec jest --config ./test/jest-e2e.json --runInBand
pnpm run build
```

For Docker changes, also run:

```sh
docker build --target test -t opencode-claude-proxy:test .
docker build -t opencode-claude-proxy:local .
```

## Structure

Follow this layout:

```text
src/
├── core/          # App-wide infrastructure: config, logger, auth, redis
├── common/        # Generic reusable utilities: pipes, decorators, types
├── integrations/  # External/internal service wrappers
├── modules/       # Domain-driven modules
├── events/        # Domain event publishers/listeners
├── commands/      # CLI jobs and cron logic
├── app.module.ts
└── main.ts
```

Naming conventions:

| Type | Convention | Example |
| --- | --- | --- |
| Domain folder | Singular | `message/`, `model/` |
| Reusable code | Plural | `types/`, `pipes/` |
| Service | `[name].service.ts` | `message.service.ts` |
| Module | `[name].module.ts` | `claude-code.module.ts` |
| DTO | `[action]-[entity].dto.ts` or domain DTO name | `anthropic-message.dto.ts` |
| Client | `[provider]-[entity].client.ts` | `opencode-go-ai.client.ts` |
| Guard/Pipe | `[name].guard.ts` / `[name].pipe.ts` | `jwt.guard.ts` |

## Tests

- Unit tests live beside implementation files as `*.spec.ts`.
- E2E tests live in `test/` and use `*.e2e-spec.ts`.
- Prefer focused tests for behavior changes before editing production code.

## Logging

Request logging is handled in `src/core/logger/`.

- Preserve `x-request-id` propagation.
- Model-call logs should include request id, requested model, upstream model, input/output token usage, and `message="..."` preview.
- Do not log full long prompts or API keys.

## Environment

Runtime configuration comes from `.env`:

```sh
OPENCODE_API_KEY=your-opencode-go-api-key
PORT=3000
REQUEST_BODY_LIMIT=10mb
```

Never commit `.env` or secrets.

## Git

Use this local commit identity for this repository:

```sh
git config user.name kingchan818
git config user.email 61489623+kingchan818@users.noreply.github.com
```
