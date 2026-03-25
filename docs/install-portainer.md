# Mcraftr on Portainer

Portainer is a good fit for Mcraftr if you already manage your Docker host there.

This is an alternative deployment path. For the easiest first install, start with `./install.sh` from the repo root and use Portainer when you specifically want stack management there.

## Easiest Path

Use one of the shipped compose files as a stack template:

- `docker-compose.yml` for local builds
- `deploy/compose/quick-connect.image.compose.yaml` for image-based Quick Connect
- `deploy/compose/full-stack.image.compose.yaml` for image-based Full Mcraftr Stack

## Recommended Image

```text
ghcr.io/deployfaith/mcraftr:latest
```

## Required Services

- Mcraftr app
- Redis
- persistent bind/volume for `/app/data`

## Required Environment Variables

At minimum:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `MCRAFTR_ADMIN_USER`
- `MCRAFTR_ADMIN_PASS`
- `MCRAFTR_ENC_KEY`
- `REDIS_PASSWORD`
- `REDIS_URL`

## Quick Connect Mode

For the simplest Portainer install:

1. deploy `deploy/compose/quick-connect.image.compose.yaml`
2. provide env vars
3. expose `3050` (or map it to your preferred host port)
4. mount persistent data to `/app/data`
5. configure your Minecraft server from inside the Mcraftr UI

## Full Mcraftr Stack

For the full stack compose:

1. deploy `deploy/compose/full-stack.image.compose.yaml`
2. mount your Minecraft server data into Beacon at `/data`
3. expose the app normally
4. configure Relay + Beacon in the Mcraftr server setup flow

The full-stack image compose file is the best reference for how to model Portainer stack services.
