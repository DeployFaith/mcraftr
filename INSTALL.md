# Mcraftr Install Guide

This guide is organized around the easiest path first.

## Option 1: Easiest Local, Private-Network, or LAN Install

Best for most users on a home server, VPS, mini PC, NAS, or local Docker host.

### 1. Clone the repo

```bash
git clone https://github.com/DeployFaith/mcraftr.git
cd mcraftr
```

### 2. Run the installer

```bash
chmod +x install.sh
./install.sh
```

The installer can configure Mcraftr for:

- this machine only
- a private network like Tailscale, WireGuard, or another VPN
- your local network
- a public domain with HTTPS

It creates `.env`, generates secrets, starts Docker services, and prints the URL to open.

If `.env` already exists, the installer preserves it by default and lets you reuse it, update a few values, or replace it completely.

### Which mode should you choose?

- `This machine only` keeps Mcraftr on `localhost`.
- `Private network` binds to a specific private IP or VPN hostname that already belongs to this machine.
- `Local network` binds to every LAN-facing interface with `0.0.0.0`.
- `Public domain` keeps Mcraftr private on the host and lets Caddy expose HTTPS.

### 3. Sign in

Use the admin email and password from the installer.

### 4. Add your Minecraft server

In Mcraftr, choose `Quick Connect` and enter:

- server address
- RCON port
- RCON password
- optional Minecraft version override

Your Minecraft server can be local, on your LAN, on a private VPN, or on a remote VPS.

## Option 2: Public Domain Install With Caddy

This path is also available through `./install.sh`.

Choose `Public domain` in the installer, then provide:

- your public domain
- your Let's Encrypt email

The installer starts:

- Mcraftr
- Redis
- Caddy for TLS and reverse proxying

### DNS Requirements

Point your domain's A or AAAA record at the host running Docker before or shortly after the first start.

### Exposure Model

For public installs:

- Caddy exposes `80` and `443`
- Mcraftr itself stays bound to localhost on the host machine

That keeps the app port private while still giving users a clean `https://your-domain` entrypoint.

## Option 3: Full Mcraftr Stack

Use this if you want the richer Mcraftr feature set beyond plain RCON.

`Full Mcraftr Stack` adds:

- `Relay` for Mcraftr's live structured server operations
- `Beacon` for filesystem-backed Minecraft data access

### Requirements

- reachable Minecraft RCON
- a compatible Relay API integration installed on the Minecraft server
- Beacon-enabled Mcraftr deployment
- readable Minecraft server data path mounted into Beacon

Relay is Mcraftr's live integration layer. Your plugin or mod exposes a Relay prefix over RCON, and Mcraftr uses that prefix for structured world, entity, terminal, and advanced admin workflows.

Beacon is Mcraftr's read-only data layer. It scans your Minecraft data directory for worlds, structures, plugins, entity presets, maps, and related metadata.

Read more:

- `docs/full-stack-relay-and-beacon.md`
- `docs/relay-api.md`
- `docs/beacon.md`

### Image-Based Full Stack

1. Copy the env file:

```bash
cp .env.example .env
```

2. Set at least:

- `MCRAFTR_IMAGE`
- `MCRAFTR_MINECRAFT_DATA`
- optional `MCRAFTR_BEACON_TOKEN`
- optional `MCRAFTR_SCHEMATICS_DIR`
- optional `MCRAFTR_ENTITY_PRESET_DIR`

3. Start the full stack:

```bash
docker compose -f deploy/compose/full-stack.image.compose.yaml up -d
```

4. In Mcraftr, choose `Full Mcraftr Stack` and enter:

- RCON details
- Relay prefix
- Beacon URL
- Beacon token if required

## Option 4: Alternative Platforms

If you already manage your infrastructure through another control plane, these are supported but intentionally secondary to the default installer.

### Dokploy

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

### Coolify

See `docs/install-coolify.md`.

### Portainer

See `docs/install-portainer.md`.

## What Mcraftr Needs At Runtime

No matter which deployment platform you use, Mcraftr needs:

- a `mcraftr` app container or Node runtime
- Redis
- persistent storage for `/app/data`
- port `3050` exposed internally
- the environment variables from `.env.example`

`Quick Connect` only needs RCON.

`Full Mcraftr Stack` additionally needs Relay and Beacon.
