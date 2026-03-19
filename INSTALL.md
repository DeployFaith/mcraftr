# Mcraftr Install Guide

This guide focuses on the easiest supported ways to run Mcraftr.

## Choose a Path

- `Quick Connect` — fastest setup, RCON-only, no Bridge or Beacon required
- `Full Mcraftr Stack` — RCON + Bridge + Beacon, recommended for the full product

## Live Demo

If you want to try Mcraftr before installing it:

- App: `https://demo.mcraftr.deployfaith.xyz/login`
- Access: `https://demo.mcraftr.deployfaith.xyz/demo`
- Sign-in: one click creates or reuses a temporary demo account for your browser
- Demo Minecraft server: `play.demo.mcraftr.deployfaith.xyz:25566`

Notes:

- This is a shared demo environment.
- Demo state resets every 12 hours.
- Temporary demo accounts are cleaned up automatically and profile changes stay locked.

## Bridge And Beacon, Plainly

`Quick Connect` only uses RCON.

`Full Mcraftr Stack` adds two extra pieces:

- `Bridge` — exposes richer Minecraft-side operations that go beyond plain RCON command flows
- `Beacon` — gives Mcraftr access to Minecraft-side data paths for world-aware catalogs, previews, and filesystem-backed context

Use `Quick Connect` if you just want to manage a server over RCON.

Use `Full Mcraftr Stack` if you want the worlds, structures, entities, and richer Mcraftr-specific workflows.

## Option 1: Quick Connect With Docker Compose

Best for most users on a VPS, home server, or local Docker host.

### 1. Clone the repo

```bash
git clone https://github.com/DeployFaith/mcraftr.git
cd mcraftr
```

### 2. Generate a working `.env`

```bash
npm run setup:env
```

### 3. Edit `.env`

Minimum fields to review:

- `NEXTAUTH_URL`
- `MCRAFTR_ADMIN_USER`
- `MCRAFTR_ADMIN_PASS`

If you are only testing locally, you can leave:

```text
NEXTAUTH_URL=http://localhost:3054
```

### 4. Start Mcraftr

```bash
docker compose up -d --build
```

### 5. Open the app

```text
http://localhost:3054
```

### 6. Add your Minecraft server

In Mcraftr, choose `Quick Connect` and enter:

- server address
- RCON port
- RCON password
- optional Minecraft version override

## Option 2: Quick Connect With a Prebuilt Docker Image

Use this if you do not want to build locally.

### 1. Copy the example env file

```bash
cp .env.example .env
```

### 2. Edit `.env`

Set at least:

- `NEXTAUTH_URL`
- `MCRAFTR_ADMIN_USER`
- `MCRAFTR_ADMIN_PASS`
- `MCRAFTR_IMAGE`

Recommended image name once GHCR publishing is enabled:

```text
ghcr.io/deployfaith/mcraftr:latest
```

### 3. Start the image-based stack

```bash
docker compose -f deploy/compose/quick-connect.image.compose.yaml up -d
```

## Option 3: Full Mcraftr Stack With Docker Compose

Use this if you want Worlds, structures, entities, maps, and the designed Mcraftr workflow.

### Requirements

- reachable Minecraft RCON
- Bridge plugin/adapter installed on the Minecraft server
- Beacon-enabled Mcraftr deployment
- a readable host path for your Minecraft server data

### 1. Copy the env file

```bash
cp .env.example .env
```

### 2. Edit `.env`

In addition to the normal app values, set:

- `MCRAFTR_IMAGE`
- `MCRAFTR_MINECRAFT_DATA`
- `MCRAFTR_BEACON_TOKEN` if you want Beacon auth
- optional `MCRAFTR_SCHEMATICS_DIR`
- optional `MCRAFTR_ENTITY_PRESET_DIR`

Example:

```bash
MCRAFTR_IMAGE=ghcr.io/deployfaith/mcraftr:latest
MCRAFTR_MINECRAFT_DATA=/srv/minecraft/data
MCRAFTR_SCHEMATICS_DIR=plugins/WorldEdit/schematics
MCRAFTR_ENTITY_PRESET_DIR=mcraftr/entity-presets
```

### 3. Start the full stack

```bash
docker compose -f deploy/compose/full-stack.image.compose.yaml up -d
```

### 4. In Mcraftr, choose `Full Mcraftr Stack`

Enter:

- RCON details
- Bridge command prefix
- Beacon URL
- Beacon token if required

## Option 4: Dokploy

Mcraftr includes Dokploy templates and a deploy script.

Use:

```bash
npm run dokploy:deploy
```

You will need:

- `DOKPLOY_BASE_URL`
- `DOKPLOY_API_KEY`
- the normal app env values
- either `MCRAFTR_IMAGE` or `MCRAFTR_BUILD_CONTEXT_URL`

## Platform Notes

- Coolify: see `docs/install-coolify.md`
- Portainer: see `docs/install-portainer.md`

## What Mcraftr Actually Needs At Runtime

No matter which deployment platform you use, Mcraftr needs:

- a `mcraftr` app container or Node runtime
- Redis
- persistent storage for `/app/data`
- port `3050` exposed internally
- the environment variables from `.env.example`

`Quick Connect` only needs RCON.

`Full Mcraftr Stack` additionally needs Bridge and Beacon.
