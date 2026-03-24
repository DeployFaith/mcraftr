# Mcraftr

Mcraftr is a self-hosted Minecraft admin panel for fast, opinionated server management over RCON.

It gives you a polished web UI for moderation, player tools, server actions, chat, schedules, theming, and account management without trying to become a full host-control panel.

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

* server status and quick admin actions
* player moderation and live player context
* chat and broadcast tools
* scheduled recurring server actions
* per-user access control and feature policies
* personalized UI themes, fonts, sounds, and profile avatars

## Connection Modes

### Quick Connect

RCON-only compatibility mode for broad server support.

Use this if you want the fastest setup and already have a reachable RCON endpoint.

### Full Mcraftr Stack

RCON + Bridge + Beacon for the full intended Mcraftr experience.

Use this if you want richer world-aware operations, catalogs, previews, and filesystem-backed Minecraft context.

What Full Stack adds over plain RCON:

* structure catalogs and placement metadata
* entity catalogs and preset-backed spawning
* world-aware previews and inventory context
* filesystem-backed access to Minecraft-side data through Beacon

What each piece does:

* `RCON` handles normal command execution and server interaction
* `Bridge` exposes extra Minecraft-side operations that plain RCON cannot model cleanly
* `Beacon` gives Mcraftr read access to Minecraft-side data paths so the app can power richer world-aware features

## Core Model

Mcraftr follows a simple model:

* Mcraftr talks to Minecraft through RCON
* accounts live in Mcraftr, not in Minecraft
* one Mcraftr account can manage multiple saved servers
* one browser can keep multiple Mcraftr accounts available for quick switching

## What Mcraftr Is Not

Mcraftr is intentionally **not** a generic hosting controller.

It does not try to be:

* a file manager
* a plugin installer
* a Docker or host manager
* a backup orchestration suite
* a world provisioning platform

Mcraftr works best as a focused Minecraft operations panel sitting in front of one or more existing servers.

## Main Features

### Dashboard

* current server status
* online player count
* TPS, version, weather, and time snapshot
* quick links into major admin areas

### Players

* live player list
* session, vitals, location, and effects
* inventory inspection and item deletion
* recent player context

### Actions

* day/night and weather controls
* gamemode, abilities, and teleport tools
* item catalog with quantity controls
* built-in kits and custom kit builder

### Chat

* chat history
* admin broadcasts
* direct messages from the panel

### Admin

* moderation tools
* server terminal
* rules, difficulty, and selected gamerules
* schedules
* audit history
* user management and feature policies

### Personalization

* dark/light mode
* accent colors and theme packs
* font controls
* sound effects and background music
* built-in or uploaded profile avatars

Theme pack format docs: `docs/theme-packs.md`

## Quick Start

Mcraftr is easiest to run with Docker Compose.

1. Clone the repo
2. Generate your local environment file:

```bash
npm run setup:env
```

3. Review and update at least these values in `.env`:

* `NEXTAUTH_URL`
* `MCRAFTR_ADMIN_USER`
* `MCRAFTR_ADMIN_PASS`

4. Start Mcraftr:

```bash
docker compose up -d --build
```

5. Open:

```txt
http://localhost:3054
```

6. Log in with the admin account from `.env`
7. Add your Minecraft server in **Quick Connect** mode using:

   * server address
   * RCON port
   * RCON password
   * optional Minecraft version override

For fuller setup and deployment details, see [`INSTALL.md`](./INSTALL.md).

## Requirements

Mcraftr always requires a reachable Minecraft RCON endpoint.

In `server.properties`:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=your-secure-password
```

You will also need:

* Docker
* Docker Compose

Mcraftr brings its own app container, Redis, and SQLite storage in the default Docker setup.

## Deployment

Supported deployment styles include:

* Docker Compose with local build
* Docker Compose with a prebuilt image
* Dokploy
* other container platforms that can run the app image, Redis, and persistent storage

For full installation and deployment guides, see:

* [`INSTALL.md`](./INSTALL.md)
* [`ROADMAP.md`](./ROADMAP.md)
* [`CONTRIBUTING.md`](./CONTRIBUTING.md)

## Configuration

Important runtime variables include:

* `NEXTAUTH_SECRET`
* `MCRAFTR_ADMIN_USER`
* `MCRAFTR_ADMIN_PASS`
* `MCRAFTR_ENC_KEY`
* `REDIS_URL`
* `DATA_DIR`
* `ALLOW_REGISTRATION`
* `MCRAFTR_PROTECTED_ACCOUNTS` (optional, comma-separated)

See `.env.example` for the full configuration surface.

## Tech Stack

* Next.js 15
* React 19
* TypeScript
* SQLite
* Redis
* Tailwind CSS
* rcon-client

## Security

* RCON passwords are encrypted at rest
* authentication is session-based
* saved device accounts use encrypted secure cookies
* admin-only routes are enforced server-side

## Contributing

If you want to contribute, start with [`CONTRIBUTING.md`](./CONTRIBUTING.md) and check the near-term priorities in [`ROADMAP.md`](./ROADMAP.md).

## Support

Mcraftr is open source and free to use. If you'd like to support ongoing development, you can do that here:

- https://buymeacoffee.com/deployfaith

## License

MIT. See [`LICENSE`](./LICENSE).
