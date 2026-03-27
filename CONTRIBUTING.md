# Contributing to Mcraftr

Thanks for your interest in Mcraftr.

Mcraftr is still early, so the best contributions are focused, practical improvements that make the panel more reliable, easier to deploy, or better to use day to day.

## Good Areas to Help

- bug fixes in core admin flows
- better docs and deployment guides
- Playwright coverage for high-value user paths
- UI polish that improves readability and speed for real server admins
- Full Stack documentation and integration clarity

## Before You Start

1. Read [`README.md`](./README.md) for product scope.
2. Read [`INSTALL.md`](./INSTALL.md) for local setup.
3. Check [`ROADMAP.md`](./ROADMAP.md) to avoid duplicating active priorities.

## Local Setup

```bash
npm install
npm run setup:env
docker compose up -d --build
```

App default local URL:

```text
http://localhost:3054
```

## Development Guidelines

- Keep changes focused.
- Prefer small, reviewable pull requests.
- Preserve the current project style:
  - single quotes
  - semicolon-free formatting
  - strict TypeScript
- Do not broaden scope with unrelated refactors.
- Keep user-facing error text safe and actionable.

## Testing

Run the most relevant checks for your change:

```bash
npm run build
npm run pw:audit
```

Before running Playwright, set a local `PLAYWRIGHT_BASE_URL` or `NEXTAUTH_URL`.

Without one of those values, the current Playwright config falls back to the hosted DeployFaith URL instead of your local app.

Useful targeted commands:

```bash
npm run pw:screenshots:highlights
npm run pw:screenshots:long-sections
npx playwright test tests/playwright/smoke.spec.ts --project=desktop-chromium
```

## Pull Requests

Good PRs should include:

- a clear explanation of why the change matters
- screenshots for visible UI changes
- notes about any setup or migration impact
- the exact verification commands you ran

## Scope Reminder

Mcraftr is not trying to become a generic hosting platform.

Changes that fit best:

- RCON admin UX
- scheduling and moderation
- player context and operational tooling
- Full Stack bridge/beacon workflows
- self-hosted deployment quality

Changes that are lower priority unless strongly justified:

- Docker host management
- plugin marketplace/install flows
- generic backup orchestration
- full file-manager style server control
