<!-- SCREENSHOT: logo -->

<div align="center">

# Mcraftr

**A beautiful, modern Minecraft server admin panel**

[Features](#features) • [Tech Stack](#tech-stack) • [Screenshots](#screenshots) • [Self-Hosting](#self-hosting) • [Environment Variables](#environment-variables) • [Getting Started](#getting-started) • [API](#api)

</div>

---

Mcraftr is a self-hosted web panel for managing Minecraft servers via RCON. It provides a sleek, tab-based interface for player management, server actions, real-time chat monitoring, and administrative controls.

> **Note:** Mcraftr connects to your Minecraft server's RCON port. The server must have RCON enabled and accessible from the Mcraftr host.

---

## Features

### Players Tab
- **Real-time player list** — See who's online with ping, dimension, and session duration
- **Player details panel** — Health, hunger, XP level, coordinates, gamemode
- **Inventory browser** — View and manage player inventory; clear individual items
- **Effect tracker** — See active potion effects and status indicators

### Actions Tab
- **Weather control** — Toggle day/night, clear sky, or storm
- **Gamemode switching** — Creative, Survival, Adventure
- **Ability toggles** — Fly, Heal, Night Vision, Speed, Invisibility, Super Jump, Strength, Haste
- **Item giver** — Browse full Minecraft item catalog (blocks, items, tools, armor)
- **Kit system** — Pre-built kits: Starter, Builder, Explorer, Combat, Admin

### Admin Tab (Admin-only)
- **Server status dashboard** — Online players, TPS, version, weather, time of day
- **RCON console** — Execute arbitrary commands with history
- **World management** — Set time, weather, difficulty, gamerules, save/stop
- **User management** — Create users, change roles (admin/user), delete users
- **Audit log** — Full history of admin actions (bans, kicks, item giveaways, etc.)

### Chat Tab
- **Broadcast history** — View all messages sent via the panel
- **Private message log** — Track in-game whispers

### Settings Tab
- **Theme toggle** — Dark/Light mode
- **Accent colors** — 8 color options (cyan, blue, purple, pink, orange, yellow, red, white)
- **Account settings** — Change password, change email, delete account
- **Server info** — View configured RCON host/port, disconnect option

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Auth | NextAuth.js (credentials provider) |
| Database | SQLite (better-sqlite3) |
| Rate Limiting | Redis |
| Minecraft Protocol | RCON (rcon-client) |
| Styling | Tailwind CSS |
| Icons | Lucide React |

---

## Screenshots

<!-- SCREENSHOT: login page -->
<!-- SCREENSHOT: players tab -->
<!-- SCREENSHOT: actions tab -->
<!-- SCREENSHOT: admin tab -->
<!-- SCREENSHOT: settings tab - accent colors -->

---

## Self-Hosting

### Prerequisites

- Node.js 22+ (for local development)
- Docker & Docker Compose (for production deployment)
- Redis (included via docker-compose)
- A Minecraft server with RCON enabled

### Quick Start with Docker Compose

```bash
# 1. Clone or download Mcraftr
cd mcraftr

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your settings (see Environment Variables below)

# 3. Create the external minecraft network (if not exists)
docker network create minecraft 2>/dev/null || true

# 4. Start the stack
docker-compose up -d

# 5. Open browser
open http://localhost:3054
```

### Manual Setup (Development)

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The app runs on `http://localhost:3000` in development mode.

### Enable RCON on Your Minecraft Server

Add or edit these in your `server.properties`:

```properties
enable-rcon=true
rcon.port=25575
rcon.password=your-secure-password
```

Ensure the port is accessible from the Mcraftr container/host.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXTAUTH_SECRET` | Yes | Secret key for NextAuth JWT signing (use `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | Public URL (e.g., `https://mcraftr.example.com`) |
| `MCRAFTR_ADMIN_USER` | Yes | First admin email (created on first run) |
| `MCRAFTR_ADMIN_PASS` | Yes | First admin password |
| `MCRAFTR_ENC_KEY` | Yes | AES-256 encryption key for RCON passwords at rest (`openssl rand -base64 32`) |
| `REDIS_PASSWORD` | Yes | Redis authentication password |
| `REDIS_URL` | Yes | Redis connection string (`redis://:PASSWORD@host:port`) |
| `DATA_DIR` | No | SQLite database directory (default: `/app/data`) |
| `ALLOW_REGISTRATION` | No | Set to `true` to allow public user registration (default: `false`) |

### Example `.env`

```bash
# Auth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://mcraftr.example.com

# Admin
MCRAFTR_ADMIN_USER=admin@example.com
MCRAFTR_ADMIN_PASS=secure-password-here

# Encryption
MCRAFTR_ENC_KEY=your-32-byte-key

# Redis
REDIS_PASSWORD=redis-password
REDIS_URL=redis://:redis-password@mcraftr-redis:6379

DATA_DIR=/app/data
ALLOW_REGISTRATION=false
```

---

## Getting Started

### First-Run (Admin Setup)

1. Start Mcraftr with `docker-compose up -d`
2. Visit the login page
3. The first user is created automatically from `MCRAFTR_ADMIN_USER` / `MCRAFTR_ADMIN_PASS`
4. After login, you'll be redirected to `/connect` to configure your RCON server

### Connecting a Server

1. Enter your Minecraft server hostname (e.g., `mc.example.com`)
2. Enter the RCON port (default: `25575`)
3. Enter the RCON password
4. Click **Test & Save**

### Creating Additional Users

- **If `ALLOW_REGISTRATION=true`:** Users can self-register at `/register`
- **If disabled (default):** Admins create users via the Admin tab → User Management

### Role System

| Role | Permissions |
|------|-------------|
| `user` | Players, Actions, Chat, Settings tabs |
| `admin` | All tabs + Admin tab (server controls, user management, audit logs) |

---

## API

Mcraftr exposes REST endpoints under `/api/`. All endpoints require authentication unless noted.

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/[...nextauth]` | * | NextAuth handlers (login/logout) |
| `/api/auth/register` | POST | Register new user (if enabled) |

### Account

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/account/password` | PUT | Change password |
| `/api/account/email` | PUT | Change email |
| `/api/account/delete` | DELETE | Delete account |

### Server

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/server` | GET | Get stored server config |
| `/api/server` | POST | Save server config |
| `/api/server` | DELETE | Disconnect server |

### Minecraft Commands

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/minecraft/players` | GET | List online players |
| `/api/minecraft/player` | GET | Get player stats |
| `/api/minecraft/cmd` | POST | Execute named command |
| `/api/minecraft/rcon` | POST | Execute raw RCON command |
| `/api/minecraft/broadcast` | POST | Send broadcast |
| `/api/minecraft/msg` | POST | Send private message |
| `/api/minecraft/kit` | POST | Give kit to player |
| `/api/minecraft/give` | POST | Give item to player |
| `/api/minecraft/inventory` | GET/DELETE | View/clear player inventory |
| `/api/minecraft/effects` | GET | Get player effects |
| `/api/minecraft/tp` | POST | Teleport player |
| `/api/minecraft/tploc` | POST | Teleport to coordinates |
| `/api/minecraft/ban` | POST | Ban player |
| `/api/minecraft/banlist` | GET | List bans |
| `/api/minecraft/pardon` | POST | Unban player |
| `/api/minecraft/kick` | POST | Kick player |
| `/api/minecraft/op` | POST | Grant operator |
| `/api/minecraft/pardon` | POST | Remove operator |
| `/api/minecraft/whitelist` | POST/DELETE | Add/remove whitelist |
| `/api/minecraft/difficulty` | GET/SET | Get/set difficulty |
| `/api/minecraft/gamerule` | GET/SET | Get/set gamerules |
| `/api/minecraft/server-info` | GET | Server status (TPS, version, weather, time) |
| `/api/minecraft/server-ctrl` | POST | Save/stop server |
| `/api/minecraft/chat-log` | GET | Chat message history |

### Admin

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users/[id]` | GET/PUT/DELETE | Manage user (admin only) |
| `/api/admin/players` | GET | View all known players |
| `/api/admin/audit` | GET | Get audit log |

---

## Security Notes

- RCON passwords are encrypted at rest using AES-256-GCM
- Session tokens are HTTP-only, secure cookies
- Rate limiting on RCON commands (30/60s per user)
- Middleware enforces authentication and server connection requirement
- Admin-only routes validated server-side

---

## License

<!-- Add license information here -->
