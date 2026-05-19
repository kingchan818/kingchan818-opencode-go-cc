# OpenCode Claude Proxy

NestJS proxy that exposes an Anthropic-compatible Claude Code API and forwards requests to OpenCode Go models.

## Requirements

- Node.js 22
- pnpm 10.27.0
- Docker, optional
- OpenCode Go API key

## Setup

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
```

Edit `.env`:

```sh
OPENCODE_API_KEY=your-opencode-go-api-key
PORT=3000
REQUEST_BODY_LIMIT=10mb
```

## Run Locally

```sh
pnpm run start:dev
```

The API listens on `http://localhost:3000` by default.

## API

List available models:

```sh
curl http://localhost:3000/v1/models
```

Create a message:

```sh
curl http://localhost:3000/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $OPENCODE_API_KEY" \
  -H "x-request-id: req_local_1" \
  -d '{
    "model": "opencode-go/kimi-k2.6",
    "max_tokens": 128,
    "messages": [{ "role": "user", "content": "Say hello" }]
  }'
```

Count tokens:

```sh
curl http://localhost:3000/v1/messages/count_tokens \
  -H "content-type: application/json" \
  -d '{
    "model": "opencode-go/kimi-k2.6",
    "messages": [{ "role": "user", "content": "Say hello" }]
  }'
```

## Logging

Every request gets an `x-request-id` response header. If the caller sends `x-request-id`, the proxy reuses it. Otherwise it generates a UUID.

Message calls log request id, model, upstream model, token usage, and a truncated message preview:

```text
requestId=req_123 model=opencode-go/kimi-k2.6 upstreamModel=kimi-k2.6 inputTokens=42 outputTokens=7 message="one two three four five six seven eight nine ten....."
```

## Tests

```sh
pnpm exec jest --runInBand
pnpm exec jest --config ./test/jest-e2e.json --runInBand
pnpm run build
```

Unit tests live beside implementation files. E2E tests live in `test/`.

## Docker

Build and run the production image:

```sh
docker build -t opencode-claude-proxy:local .
docker run --env-file .env -p 3000:3000 opencode-claude-proxy:local
```

Run the Docker test target:

```sh
docker build --target test -t opencode-claude-proxy:test .
```

The runtime image includes a healthcheck against `/v1/models`.

## GitHub CI

The GitHub Actions workflow runs:

- Unit tests
- E2E tests
- Nest build
- Docker test target build
- Docker production image build

After merge to `main`, CI publishes the image to GitHub Container Registry:

```text
ghcr.io/kingchan818/opencode-go-to-cc:main
ghcr.io/kingchan818/opencode-go-to-cc:sha-<commit>
ghcr.io/kingchan818/opencode-go-to-cc:latest
```

If GHCR push fails with `permission_denied: write_package`, check the repository settings:

- `Settings -> Actions -> General -> Workflow permissions` should allow read and write permissions.
- If the package already exists, ensure it grants this repository write access.
- If `GITHUB_TOKEN` is still blocked, create a GitHub token with `write:packages` and add it as an Actions secret named `GHCR_TOKEN`.

## Project Structure

```text
src/
├── core/          # App-wide infrastructure
├── common/        # Generic reusable utilities and types
├── integrations/  # External service clients
├── modules/       # Domain modules
├── events/        # Event publishers/listeners
├── commands/      # CLI jobs and cron logic
├── app.module.ts
└── main.ts
```
