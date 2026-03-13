# Mcraftr on Coolify

Coolify can run Mcraftr either from source or from a prebuilt Docker image.

## Recommended Path

Use a prebuilt image when available.

Recommended image:

```text
ghcr.io/deployfaith/mcraftr:latest
```

## Minimum Services

- one Mcraftr app service
- one Redis service, or an external Redis instance
- persistent volume mounted to `/app/data`

## Required Environment Variables

At minimum:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `MCRAFTR_ADMIN_USER`
- `MCRAFTR_ADMIN_PASS`
- `MCRAFTR_ENC_KEY`
- `REDIS_PASSWORD`
- `REDIS_URL`

## Port

Mcraftr listens on:

```text
3050
```

Set Coolify to expose that port through your chosen domain.

## Quick Connect Mode

For the easiest install, start with:

- Mcraftr app
- Redis
- `/app/data` volume

Then configure Minecraft access inside the UI with `Quick Connect`.

## Full Mcraftr Stack

For the full product:

- run the Mcraftr app image
- run Beacon as a second process/container using the same image with:

```text
node sidecar/server.mjs
```

- mount Minecraft server data read-only into Beacon at `/data`
- point Mcraftr at the Beacon URL in the server setup screen

You can use `deploy/compose/full-stack.image.compose.yaml` as the reference topology.
