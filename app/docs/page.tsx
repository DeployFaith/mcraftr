import type { Metadata } from 'next'
import Image from 'next/image'
import dashboardShot from '@/docs/screenshots/highlights/03-dashboard.png'
import playersShot from '@/docs/screenshots/highlights/04-players.png'
import worldsShot from '@/docs/screenshots/highlights/06-worlds.png'
import terminalShot from '@/docs/screenshots/highlights/07-terminal.png'
import settingsShot from '@/docs/screenshots/highlights/10-settings.png'
import { PublicSiteFooter, PublicSiteHeader } from '@/app/components/PublicSiteChrome'

const SUPPORT_URL = 'https://buymeacoffee.com/deployfaith'
const REPO_URL = 'https://github.com/deployfaith/mcraftr'
const DEMO_APP_URL = 'https://demo.mcraftr.deployfaith.xyz'
const DEMO_LAUNCH_URL = `${DEMO_APP_URL}/demo`

function demoLaunchHref(returnTo = '/minecraft') {
  return `${DEMO_LAUNCH_URL}?returnTo=${encodeURIComponent(returnTo)}`
}

export const metadata: Metadata = {
  title: 'Mcraftr Docs',
  description: 'Docs for Mcraftr, the self-hosted Minecraft admin panel for fast, opinionated server management over RCON.',
  alternates: {
    canonical: 'https://mcraftr.deployfaith.xyz/docs',
  },
  openGraph: {
    type: 'website',
    url: 'https://mcraftr.deployfaith.xyz/docs',
    title: 'Mcraftr Docs',
    description: 'Product docs, install guidance, setup modes, screenshots, and repo links for Mcraftr.',
    images: [
      {
        url: 'https://mcraftr.deployfaith.xyz/social-card-v2.png',
        width: 1200,
        height: 630,
        alt: 'Mcraftr docs social preview card',
      },
    ],
  },
}

const topNav = [
  { href: '#features', label: 'Features' },
  { href: '#screenshots', label: 'Screenshots' },
  { href: '#modes', label: 'Modes' },
  { href: '#install', label: 'Install' },
  { href: '#faq', label: 'FAQ' },
]

const docsHeaderNavLinks = [
  { href: '/', label: 'Home' },
  ...topNav,
]

const docsHeaderActions = [
  { href: REPO_URL, label: 'GitHub', external: true },
  { href: demoLaunchHref(), label: 'Demo', external: true },
  { href: SUPPORT_URL, label: 'Support', external: true },
]

const docsFooterLinks = [
  { href: '/', label: 'Home' },
  { href: REPO_URL, label: 'GitHub', external: true },
  { href: demoLaunchHref(), label: 'Demo', external: true },
]

const featureGroups = [
  {
    title: 'Operations surfaces',
    items: [
      {
        name: 'Dashboard',
        desc: 'Current server status, player count, TPS, time, weather, and quick paths into the sections you actually use.',
      },
      {
        name: 'Players',
        desc: 'Live player list, recent player context, vitals, effects, inventory inspection, and moderation tools.',
      },
      {
        name: 'Actions',
        desc: 'High-frequency server commands, weather and time controls, teleport flows, kits, items, and routine admin shortcuts.',
      },
      {
        name: 'Worlds',
        desc: 'World-aware workflows instead of a flat command box, with richer context when you run the full stack.',
      },
    ],
  },
  {
    title: 'Admin + customization',
    items: [
      {
        name: 'Terminal',
        desc: 'Raw RCON when you need direct control, with command discovery and docs-oriented flows built around it.',
      },
      {
        name: 'Admin',
        desc: 'Moderation, schedules, audit history, server controls, user management, and feature policy controls in one place.',
      },
      {
        name: 'Chat',
        desc: 'Live chat history, broadcasts, and panel-based messages without needing to camp in the game client or logs.',
      },
      {
        name: 'Settings',
        desc: 'Theme packs, accent colors, fonts, sound effects, background music, avatars, and saved-server preferences.',
      },
    ],
  },
]

const screenshots = [
  {
    src: dashboardShot,
    alt: 'Mcraftr dashboard overview',
    title: 'Dashboard view',
    desc: 'Start from current state instead of digging through server console output first.',
  },
  {
    src: playersShot,
    alt: 'Mcraftr players panel',
    title: 'Player context',
    desc: 'Inspect player state and jump directly into operator actions.',
  },
  {
    src: worldsShot,
    alt: 'Mcraftr worlds panel',
    title: 'World-aware tools',
    desc: 'The full stack gives the app more Minecraft-side context than plain RCON can expose.',
  },
  {
    src: terminalShot,
    alt: 'Mcraftr server terminal',
    title: 'Terminal workspace',
    desc: 'Keep raw command power available without making it the whole product.',
  },
  {
    src: settingsShot,
    alt: 'Mcraftr settings screen',
    title: 'Personalization',
    desc: 'Tune the interface and export theme packs for portable custom setups.',
  },
]

const modeCards = [
  {
    title: 'Quick Connect',
    eyebrow: 'Fastest path',
    desc: 'RCON-only compatibility mode for the fastest setup and broad support. Best when you just want a better server operations UI in front of the server you already run.',
    bullets: [
      'Requires a reachable RCON endpoint and the normal app stack',
      'No Bridge or Beacon required',
      'Best for broad compatibility and shortest setup time',
    ],
  },
  {
    title: 'Full Mcraftr Stack',
    eyebrow: 'Recommended path',
    desc: 'Adds Bridge and Beacon to unlock richer world-aware operations, structure and entity catalogs, previews, and filesystem-backed Minecraft context.',
    bullets: [
      'RCON still handles normal command execution',
      'Bridge exposes Minecraft-side workflows plain RCON cannot model cleanly',
      'Beacon gives Mcraftr access to Minecraft-side data paths for richer context',
    ],
  },
]

const installSteps = [
  'Clone the repo and run `npm run setup:env` to generate a working `.env`.',
  'Review at least `NEXTAUTH_URL`, `MCRAFTR_ADMIN_USER`, and `MCRAFTR_ADMIN_PASS`.',
  'Start Mcraftr with `docker compose up -d --build`.',
  'Open `http://localhost:3054`, sign in, and add your server with Quick Connect or Full Mcraftr Stack.',
]

const envVars = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'MCRAFTR_ADMIN_USER',
  'MCRAFTR_ADMIN_PASS',
  'MCRAFTR_ENC_KEY',
  'REDIS_URL',
  'DATA_DIR',
  'ALLOW_REGISTRATION',
]

const platformGuides = [
  {
    title: 'Coolify',
    desc: 'Run Mcraftr as one app service with Redis and a persistent `/app/data` volume. Expose port `3050` and add Beacon if you want the full stack.',
    href: `${REPO_URL}/blob/main/docs/install-coolify.md`,
  },
  {
    title: 'Portainer',
    desc: 'Use the shipped compose files as stack templates for local build, Quick Connect image deploys, or full-stack image deploys.',
    href: `${REPO_URL}/blob/main/docs/install-portainer.md`,
  },
  {
    title: 'Theme packs',
    desc: 'Theme packs can bundle colors, accent, sound effects, and background music into one JSON file for portable personalization.',
    href: `${REPO_URL}/blob/main/docs/theme-packs.md`,
  },
]

const repoDocs = [
  { label: 'GitHub repo', href: REPO_URL },
  { label: 'README', href: `${REPO_URL}/blob/main/README.md` },
  { label: 'Install guide', href: `${REPO_URL}/blob/main/INSTALL.md` },
  { label: 'Theme packs', href: `${REPO_URL}/blob/main/docs/theme-packs.md` },
  { label: 'Coolify install', href: `${REPO_URL}/blob/main/docs/install-coolify.md` },
  { label: 'Portainer install', href: `${REPO_URL}/blob/main/docs/install-portainer.md` },
  { label: 'Roadmap', href: `${REPO_URL}/blob/main/ROADMAP.md` },
  { label: 'Contributing', href: `${REPO_URL}/blob/main/CONTRIBUTING.md` },
]

const faq = [
  {
    q: 'What is Mcraftr?',
    a: 'Mcraftr is a self-hosted Minecraft admin panel for fast server management over RCON, with an optional richer full-stack mode when you want more Minecraft-side context.',
  },
  {
    q: 'Do I need to change hosts?',
    a: 'No. Mcraftr is built to sit in front of the server you already run as long as the app can reach it over RCON.',
  },
  {
    q: 'What is the difference between Quick Connect and Full Mcraftr Stack?',
    a: 'Quick Connect is the shortest RCON-first path. Full Mcraftr Stack adds Bridge and Beacon for richer world-aware workflows, previews, and filesystem-backed context.',
  },
  {
    q: 'What does Mcraftr need at runtime?',
    a: 'The app needs a Mcraftr app runtime, Redis, persistent storage for `/app/data`, and a reachable RCON endpoint. Full Stack additionally needs Bridge and Beacon.',
  },
  {
    q: 'Can I try it before I install it?',
    a: 'Yes. The public demo creates or reuses a temporary demo account in your browser. It is shared, resets every 12 hours, and is meant for trying the real interface quickly.',
  },
  {
    q: 'Is the docs page the only source of truth?',
    a: 'No. This page is a landing-friendly summary. The GitHub repo docs are linked throughout this page so you can jump straight to the full source documentation.',
  },
]

const quickStartSnippet = `npm run setup:env\ndocker compose up -d --build\n# open http://localhost:3054`

const runtimeSnippet = `enable-rcon=true\nrcon.port=25575\nrcon.password=your-secure-password`

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--accent)]">{children}</p>
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <PublicSiteHeader
        navLinks={docsHeaderNavLinks}
        actionLinks={docsHeaderActions}
        mobilePrimaryLink={{ href: demoLaunchHref(), label: 'Demo', external: true }}
        mobileMenuLabel="Open docs navigation"
      />

      <div className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--bg2)_86%,transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          {topNav.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <section className="relative overflow-hidden border-b border-[var(--border)] px-4 pb-20 pt-14 sm:px-6 sm:pb-24 lg:pb-28 lg:pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--accent)_15%,transparent),transparent_38%),linear-gradient(180deg,color-mix(in_srgb,var(--bg2)_82%,transparent),transparent_100%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-start lg:gap-12">
          <div className="max-w-3xl">
            <SectionEyebrow>Mcraftr docs</SectionEyebrow>
            <h1 className="max-w-3xl text-[2.6rem] font-bold leading-[0.94] sm:text-5xl lg:text-[4.2rem] lg:tracking-[-0.05em]" style={{ fontFamily: 'var(--font-operator)' }}>
              The landing-page version of the docs,
              <br />
              <span className="text-[var(--accent)]">with the repo one click away.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[1rem] leading-7 text-[var(--text-dim)] sm:text-[1.08rem] sm:leading-8">
              This page pulls together the important product, setup, and installation guidance already living in the repository. It is built for scanning quickly on the public site, while still linking back to the GitHub docs for the full source material.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={demoLaunchHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-6 py-3.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] sm:hover:scale-105"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
              >
                Open Demo
              </a>
              <a
                href={`${REPO_URL}/blob/main/README.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border px-6 py-3.5 text-sm font-semibold transition-all duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: 'var(--border)' }}
              >
                View Repo Docs
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border px-6 py-3.5 text-sm font-semibold text-[var(--text-dim)] transition-all duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: 'var(--border)' }}
              >
                GitHub Repo
              </a>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_88%,transparent)] p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--accent)]">Quick Connect</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">RCON-only path for the shortest install and the broadest compatibility.</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_88%,transparent)] p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--accent)]">Full Stack</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">Bridge and Beacon unlock richer world-aware operations and Minecraft-side context.</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_88%,transparent)] p-4">
                <p className="text-[0.7rem] uppercase tracking-[0.16em] text-[var(--accent)]">Repo-backed</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">Every major section on this page includes direct links back to the source docs on GitHub.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--panel)_92%,transparent)] p-5 shadow-2xl">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[var(--accent)]">Docs index</p>
            <div className="mt-4 grid gap-3">
              {repoDocs.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--bg)]/35 px-4 py-3 transition-all hover:border-[var(--accent)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[var(--text)]">{item.label}</span>
                    <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--text-dim)] transition-colors group-hover:text-[var(--accent)]">GitHub</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionEyebrow>Features</SectionEyebrow>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.45rem]">What the product actually covers</h2>
              <p className="mt-4 max-w-xl text-[1rem] leading-7 text-[var(--text-dim)]">
                Mcraftr is built for people who already have a Minecraft server and want a cleaner operations panel in front of it. It is not trying to become a generic hosting controller, file manager, plugin installer, or Docker host panel.
              </p>
              <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Source docs</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <a href={`${REPO_URL}/blob/main/README.md#why-mcraftr`} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]">Why Mcraftr</a>
                  <a href={`${REPO_URL}/blob/main/README.md#main-features`} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]">Main Features</a>
                  <a href={`${REPO_URL}/blob/main/README.md#what-mcraftr-is-not`} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]">What it is not</a>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {featureGroups.map((group) => (
                <div key={group.title} className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] p-6">
                  <h3 className="text-lg font-semibold text-[var(--accent)]">{group.title}</h3>
                  <div className="mt-5 space-y-4">
                    {group.items.map((item) => (
                      <div key={item.name} className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/30 p-4">
                        <p className="text-sm font-semibold text-[var(--text)]">{item.name}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="screenshots" className="scroll-mt-24 border-y border-[var(--border)] bg-[var(--bg2)] px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionEyebrow>Screenshots</SectionEyebrow>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.45rem]">Real product screens from the repo</h2>
              <p className="mt-4 max-w-2xl text-[1rem] leading-7 text-[var(--text-dim)]">
                The landing page already uses the repo screenshot set, so this docs page keeps the same source of truth. These are not concept mocks or fake admin dashboards.
              </p>
            </div>
            <a
              href={`${REPO_URL}/tree/main/docs/screenshots/highlights`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]"
            >
              Browse screenshot source on GitHub
            </a>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {screenshots.map((shot, index) => (
              <div key={shot.title} className={`group overflow-hidden rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)] transition-all duration-200 hover:border-[var(--accent)] ${index === 0 ? 'xl:col-span-2' : ''}`}>
                <div className="relative aspect-[16/10] overflow-hidden border-b border-[var(--border)] bg-[var(--bg)]/45">
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    fill
                    sizes={index === 0 ? '(max-width: 1280px) 100vw, 66vw' : '(max-width: 1280px) 100vw, 33vw'}
                    className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </div>
                <div className="space-y-2 px-5 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-[var(--accent)]">{shot.title}</h3>
                    <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--text-dim)]">Repo asset</span>
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-dim)]">{shot.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="modes" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionEyebrow>Modes</SectionEyebrow>
          <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.45rem]">Choose the setup that matches your server</h2>
          <p className="mt-4 max-w-3xl text-[1rem] leading-7 text-[var(--text-dim)]">
            Mcraftr always needs a reachable RCON endpoint. From there, you can run the simple path with Quick Connect or add the rest of the Mcraftr stack when you want richer world-aware operations.
          </p>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {modeCards.map((mode) => (
              <div key={mode.title} className="rounded-[1.7rem] border border-[var(--border)] bg-[var(--panel)] p-6 lg:p-7">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">{mode.eyebrow}</p>
                <h3 className="mt-3 text-2xl font-bold">{mode.title}</h3>
                <p className="mt-4 text-[0.98rem] leading-7 text-[var(--text-dim)]">{mode.desc}</p>
                <ul className="mt-6 space-y-3 text-sm leading-6 text-[var(--text-dim)]">
                  {mode.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-[2px] text-[var(--accent)]">+</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5">
              <p className="text-sm font-semibold text-[var(--text)]">RCON</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">Handles normal command execution and baseline server interaction.</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5">
              <p className="text-sm font-semibold text-[var(--text)]">Bridge</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">Exposes richer Minecraft-side operations that plain RCON cannot model cleanly.</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg2)] p-5">
              <p className="text-sm font-semibold text-[var(--text)]">Beacon</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">Gives Mcraftr read access to Minecraft-side data paths for catalogs, previews, and filesystem-backed context.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            <a href={`${REPO_URL}/blob/main/README.md#connection-modes`} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]">Connection modes in README</a>
            <a href={`${REPO_URL}/blob/main/INSTALL.md#bridge-and-beacon-plainly`} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]">Bridge and Beacon in install docs</a>
          </div>
        </div>
      </section>

      <section id="install" className="scroll-mt-24 border-y border-[var(--border)] bg-[var(--bg2)] px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionEyebrow>Install</SectionEyebrow>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.45rem]">Start with Docker Compose, then branch out</h2>
              <p className="mt-4 max-w-3xl text-[1rem] leading-7 text-[var(--text-dim)]">
                The simplest supported path is still Docker Compose. Generate `.env`, review the core runtime values, start the app, and then connect your Minecraft server from inside the UI. For image-first installs and platform-specific guides, jump to the linked repo docs.
              </p>

              <div className="mt-8 grid gap-5 xl:grid-cols-2">
                <div className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] p-6">
                  <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Quick start</p>
                  <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-dim)]">
                    {installSteps.map((step, index) => (
                      <li key={step} className="flex gap-3">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[0.78rem] text-[var(--accent)]">{index + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <pre className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-4 text-[0.8rem] leading-6 text-[var(--text-dim)]"><code>{quickStartSnippet}</code></pre>
                </div>

                <div className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] p-6">
                  <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Required runtime shape</p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-dim)]">
                    <li>a Mcraftr app runtime or container</li>
                    <li>Redis</li>
                    <li>persistent storage mounted to `/app/data`</li>
                    <li>internal app port `3050` exposed through your chosen entrypoint</li>
                    <li>a reachable Minecraft RCON endpoint</li>
                  </ul>
                  <pre className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-4 py-4 text-[0.8rem] leading-6 text-[var(--text-dim)]"><code>{runtimeSnippet}</code></pre>
                </div>
              </div>

              <div className="mt-8 rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] p-6">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Core environment variables</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {envVars.map((item) => (
                    <code key={item} className="rounded-full border border-[var(--border)] bg-[var(--bg)]/45 px-3 py-2 text-[0.78rem] text-[var(--text-dim)]">
                      {item}
                    </code>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-dim)]">
                  Optional Full Stack and Beacon values include `MCRAFTR_SIDECAR_TOKEN`, `MCRAFTR_MINECRAFT_DATA`, `MCRAFTR_SCHEMATICS_DIR`, `MCRAFTR_ENTITY_PRESET_DIR`, `MCRAFTR_BLUEMAP_URL`, and `MCRAFTR_DYNMAP_URL`.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] p-6">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Repo docs</p>
                <div className="mt-4 grid gap-3">
                  <a href={`${REPO_URL}/blob/main/INSTALL.md`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]">Install guide</a>
                  <a href={`${REPO_URL}/blob/main/README.md#quick-start`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]">Quick start in README</a>
                  <a href={`${REPO_URL}/blob/main/README.md#configuration`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]">Configuration docs</a>
                  <a href={`${REPO_URL}/blob/main/.env.example`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]">.env example</a>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] p-6">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Platform guides</p>
                <div className="mt-4 space-y-3">
                  {platformGuides.map((guide) => (
                    <a
                      key={guide.title}
                      href={guide.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-2xl border border-[var(--border)] px-4 py-4 transition-all hover:border-[var(--accent)]"
                    >
                      <p className="text-sm font-semibold text-[var(--text)]">{guide.title}</p>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">{guide.desc}</p>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:items-start">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.45rem]">Common questions, with repo links nearby</h2>
              <p className="mt-4 text-[1rem] leading-7 text-[var(--text-dim)]">
                This keeps the high-signal answers on the landing site while still giving you the direct GitHub path when you need the full install and product docs.
              </p>
              <div className="mt-6 flex flex-col gap-3 text-sm">
                <a href={`${REPO_URL}/blob/main/README.md#live-demo`} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]">Live demo notes in README</a>
                <a href={`${REPO_URL}/blob/main/README.md#requirements`} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]">Requirements in README</a>
                <a href={`${REPO_URL}/blob/main/INSTALL.md#what-mcraftr-actually-needs-at-runtime`} target="_blank" rel="noopener noreferrer" className="text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]">Runtime requirements in install guide</a>
              </div>
            </div>

            <div className="space-y-4">
              {faq.map((item) => (
                <details key={item.q} className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                    <span className="font-medium text-[var(--text)]">{item.q}</span>
                    <span className="text-[var(--accent)] transition-transform group-open:rotate-180">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-5 pb-5 text-sm leading-7 text-[var(--text-dim)]">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] bg-[var(--bg2)] px-4 py-16 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[1.8rem] border border-[var(--border)] bg-[var(--panel)] px-6 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Still want the source docs?</p>
            <h2 className="mt-2 text-2xl font-bold">Go straight to the repo.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-dim)]">This page is the public-facing docs layer. The full README, install guide, platform notes, roadmap, and contribution docs remain linked directly from GitHub for redundancy.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-5 py-3 text-sm font-semibold transition-all hover:scale-[1.02]"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
            >
              Open GitHub Repo
            </a>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Support Mcraftr
            </a>
          </div>
        </div>
      </section>

      <PublicSiteFooter links={docsFooterLinks} tagline="Repo-backed docs for fast Minecraft server ops." />
    </main>
  )
}
