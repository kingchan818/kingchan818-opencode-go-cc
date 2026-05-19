# Claude Instructions

Read `AGENTS.md` first and follow it as the source of truth for this project.

This repository is a NestJS TypeScript service that exposes an Anthropic-compatible Claude Code API and forwards requests to OpenCode Go models.

Required verification before reporting work as complete:

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

Keep implementation aligned with the structure and conventions documented in `AGENTS.md`.
