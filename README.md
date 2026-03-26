# Mcraftr

Mcraftr is a self-hosted Minecraft admin panel for fast, opinionated server management over RCON.

It gives you a polished web UI for moderation, player tools, server actions, chat, schedules, theming, and account management without trying to become a full host-control panel.

## Fastest Install

The default Mcraftr install is local self-hosting with Docker, with private-network, LAN, and public-domain options built into the installer.

```bash
chmod +x install.sh
./install.sh
```

The installer can set up Mcraftr for:

- this machine only
- a private network like Tailscale, WireGuard, or another VPN
- your local network
- a public domain with HTTPS via Caddy

If you run it again later, it preserves your existing `.env` by default and lets you choose whether to reuse, update, or fully replace that config.

When it finishes:

1. open the URL it prints
2. sign in with the admin account you just created
3. go to `Quick Connect`
4. add your Minecraft server

Your Minecraft server can be on the same machine, somewhere else on your LAN, behind a private VPN, or on a remote VPS as long as Mcraftr can reach its RCON endpoint.

## Repository Screenshots

The full screenshot set lives in `docs/screenshots/highlights/`.

<table>
  <tr>
    <td><img src="docs/screenshots/highlights/01-login.png" alt="Login" width="100%"></td>
    <td><img src="docs/screenshots/highlights/02-connect.png" alt="Connect" width="100%"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/highlights/03-dashboard.png" alt="Dashboard" width="100%"></td>
    <td><img src="docs/screenshots/highlights/04-players.png" alt="Players" width="100%"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/highlights/05-actions.png" alt="Actions" width="100%"></td>
    <td><img src="docs/screenshots/highlights/06-worlds.png" alt="Worlds" width="100%"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/highlights/07-terminal.png" alt="Terminal" width="100%"></td>
    <td><img src="docs/screenshots/highlights/08-admin.png" alt="Admin" width="100%"></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/highlights/09-chat.png" alt="Chat" width="100%"></td>
    <td><img src="docs/screenshots/highlights/10-settings.png" alt="Settings" width="100%"></td>
  </tr>
</table>

## Why Mcraftr

Mcraftr is built for people who already have a Minecraft server and want a clean operations panel in front of it.

It is especially good at:

- server status and quick admin actions
- player moderation and live player context
- chat and broadcast tools
- scheduled recurring server actions
- per-user access control and feature policies
- personalized UI themes, fonts, sounds, and profile avatars

## Quick Connect

`Quick Connect` is the default path and works with plain RCON.

Use it if you want the fastest setup and already have a reachable RCON endpoint.

In `server.properties`:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=your-secure-password
```

Then add that server from the Mcraftr UI using:

- server address or hostname
- RCON port
- RCON password
- optional Minecraft version override

## Full Mcraftr Stack

`Full Mcraftr Stack` adds Relay and Beacon for richer world-aware features.

Use this if you want worlds, structures, entities, maps, previews, and filesystem-backed Minecraft context.

What each piece does:

- `RCON` handles normal command execution and server interaction
- `Relay` is Mcraftr's live integration layer for structured world, entity, terminal, and advanced admin features
- `Beacon` is Mcraftr's read-only data layer for worlds, structures, plugins, entity presets, maps, and filesystem-backed metadata

Relay depends on a compatible Relay API integration on your Minecraft server. Beacon runs as a separate read-only service that mounts your Minecraft data directory.

Read more:

- `INSTALL.md`
- `docs/core-and-extensions.md`
- `docs/full-stack-relay-and-beacon.md`
- `docs/relay-api.md`
- `docs/beacon.md`

## Main Features

### Dashboard

- current server status
- online player count
- TPS, version, weather, and time snapshot
- quick links into major admin areas

### Players

- live player list
- session, vitals, location, and effects
- inventory inspection and item deletion
- recent player context

### Actions

- day/night and weather controls
- gamemode, abilities, and teleport tools
- item catalog with quantity controls
- built-in kits and custom kit builder

### Chat

- chat history
- admin broadcasts
- direct messages from the panel

### Admin

- moderation tools
- server terminal
- rules, difficulty, and selected gamerules
- schedules
- audit history
- user management and feature policies

### Personalization

- dark/light mode
- accent colors and theme packs
- font controls
- sound effects and background music
- built-in or uploaded profile avatars

Theme pack format docs: `docs/theme-packs.md`

## Requirements

Mcraftr needs:

- Docker with `docker compose`
- a reachable Minecraft RCON endpoint

The default Docker setup brings its own app container, Redis, and SQLite storage.

## Install Paths

- local, private-network, or LAN self-host: `./install.sh`
- public-domain self-host with bundled HTTPS: `./install.sh`
- advanced manual deployment: `INSTALL.md`

## Alternative Platforms

If you already use a deployment platform, keep those paths as alternatives instead of your first install:

- Dokploy: use the grouped notes in `INSTALL.md`
- Coolify: `docs/install-coolify.md`
- Portainer: `docs/install-portainer.md`

## Configuration

Important runtime variables include:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `MCRAFTR_ADMIN_USER`
- `MCRAFTR_ADMIN_PASS`
- `MCRAFTR_ENC_KEY`
- `REDIS_URL`
- `DATA_DIR`
- `ALLOW_REGISTRATION`
- `MCRAFTR_ALLOW_PRIVATE_RCON_HOSTS`

See `.env.example` for the full configuration surface.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- SQLite
- Redis
- Tailwind CSS
- rcon-client

## Security

- RCON passwords are encrypted at rest
- authentication is session-based
- saved device accounts use encrypted secure cookies
- admin-only routes are enforced server-side

## Development

Use these when working on the app locally:

```bash
npm install
npm run dev
```

For fuller deployment details, contributing, and roadmap notes, see:

- `INSTALL.md`
- `CONTRIBUTING.md`
- `ROADMAP.md`

## Support

Mcraftr is open source and free to use. If you'd like to support ongoing development, you can do that here:

- https://buymeacoffee.com/deployfaith

## License

MIT. See `LICENSE`.
