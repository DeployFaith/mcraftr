import type { Metadata } from 'next'
import { PublicSiteFooter, PublicSiteHeader } from '@/app/components/PublicSiteChrome'

const COFFEE_URL = 'https://buymeacoffee.com/deployfaith'
const REPO_URL = 'https://github.com/deployfaith/mcraftr'
const DEMO_APP_URL = 'https://demo.mcraftr.deployfaith.xyz'
const DEMO_LAUNCH_URL = `${DEMO_APP_URL}/demo`

function demoLaunchHref(returnTo = '/minecraft') {
  return `${DEMO_LAUNCH_URL}?returnTo=${encodeURIComponent(returnTo)}`
}

export const metadata: Metadata = {
  title: 'Mcraftr Docs',
  description: 'The fast path to understanding Mcraftr.',
  alternates: {
    canonical: 'https://mcraftr.deployfaith.xyz/docs',
  },
  openGraph: {
    type: 'website',
    url: 'https://mcraftr.deployfaith.xyz/docs',
    title: 'Mcraftr Docs',
    description: 'Everything you need to learn the product, choose a setup path, and jump into the right GitHub docs.',
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
  { href: COFFEE_URL, label: 'Coffee', external: true },
  { href: '/support', label: 'Support' },
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
        desc: 'See server status, player count, TPS, weather, and key actions at a glance.',
      },
      {
        name: 'Players',
        desc: 'Inspect live players, view vitals and inventory, and handle moderation faster.',
      },
      {
        name: 'Actions',
        desc: 'Run common admin actions for time, weather, kits, teleporting, and more.',
      },
      {
        name: 'Worlds',
        desc: 'Unlock world-aware workflows when running the full Mcraftr stack.',
      },
    ],
  },
  {
    title: 'Admin + customization',
    items: [
      {
        name: 'Terminal',
        desc: 'Use raw RCON directly when you want full manual control.',
      },
      {
        name: 'Admin',
        desc: 'Manage policies, schedules, audit history, users, and server controls.',
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

const modeCards = [
  {
    title: 'Quick Connect',
    eyebrow: 'Fastest setup',
    desc: 'RCON-only setup',
    bullets: [
      'RCON-only setup',
      'No extra Mcraftr-side services required',
      'Best for getting started quickly',
    ],
  },
  {
    title: 'Full Mcraftr Stack',
    eyebrow: 'Recommended experience',
    desc: 'Adds world-aware workflows and richer server context',
    bullets: [
      'Adds world-aware workflows and richer server context',
      'Unlocks structures, entities, previews, and deeper tooling',
      'Best for the full Mcraftr experience',
    ],
  },
]

const installSteps = [
  'Run `npm run setup:env`',
  'Review `NEXTAUTH_URL`, `MCRAFTR_ADMIN_USER`, and `MCRAFTR_ADMIN_PASS`',
  'Start the app with `docker compose up -d --build`',
  'Open `http://localhost:3054` and choose Quick Connect or Full Stack',
]

const envVars = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'MCRAFTR_ADMIN_USER',
  'MCRAFTR_ADMIN_PASS',
  'MCRAFTR_ENC_KEY',
  'REDIS_URL',
]

const platformGuides = [
  {
    title: 'Deploy',
    desc: 'Docker Compose, prebuilt image, Dokploy, Coolify, and Portainer self-hosting paths.',
    href: `${REPO_URL}/blob/main/INSTALL.md#platform-notes`,
  },
  {
    title: 'Theme packs',
    desc: 'Theme packs can bundle colors, accent, sound effects, and background music into one JSON file for portable personalization.',
    href: `${REPO_URL}/blob/main/docs/theme-packs.md`,
  },
]

const faq = [
  {
    q: 'What is Mcraftr?',
    a: 'Mcraftr is a self-hosted Minecraft admin panel built for fast server management over RCON.',
  },
  {
    q: 'Do I need to change hosts?',
    a: 'No. Mcraftr is built to work with the server you already run.',
  },
  {
    q: 'Quick Connect or Full Stack?',
    a: 'Use Quick Connect for the fastest setup. Use Full Stack for the full feature set and deeper workflows.',
  },
  {
    q: 'What does it need?',
    a: 'At minimum, a reachable RCON endpoint. Full Stack adds extra services for richer context.',
  },
  {
    q: 'Can I try it first?',
    a: 'Yes. Open the demo to explore the interface before installing.',
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
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <SectionEyebrow>Mcraftr Docs</SectionEyebrow>
            <h1 className="max-w-3xl text-[2.6rem] font-bold leading-[0.94] sm:text-5xl lg:text-[4.2rem] lg:tracking-[-0.05em]" style={{ fontFamily: 'var(--font-operator)' }}>
              The fast path <span className="whitespace-nowrap">to understanding</span> Mcraftr.
            </h1>
            <p className="mt-6 max-w-2xl text-[1rem] leading-7 text-[var(--text-dim)] sm:text-[1.08rem] sm:leading-8">
              Everything you need to learn the product, choose a setup path, and jump into the right GitHub docs.
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
                Browse Repo Docs
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

          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionEyebrow>Features</SectionEyebrow>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.45rem]">The core surfaces</h2>
              <p className="mt-4 max-w-xl text-[1rem] leading-7 text-[var(--text-dim)]">
                Mcraftr is built to help you run the Minecraft server you already have, not replace your entire stack.
              </p>
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

      <section id="modes" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionEyebrow>Modes</SectionEyebrow>
          <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.45rem]">Choose the setup that fits your server</h2>
          <p className="mt-4 max-w-3xl text-[1rem] leading-7 text-[var(--text-dim)]">
            Both modes start with a working RCON connection. Full Stack adds deeper Minecraft-side context and richer workflows.
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

        </div>
      </section>

      <section id="install" className="scroll-mt-24 border-y border-[var(--border)] bg-[var(--bg2)] px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <SectionEyebrow>Install</SectionEyebrow>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.45rem]">Start with Docker Compose</h2>
              <p className="mt-4 max-w-3xl text-[1rem] leading-7 text-[var(--text-dim)]">
                Generate your `.env`, review the core values, bring the app up, then connect your server in the UI.
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
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Core env vars</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {envVars.map((item) => (
                    <code key={item} className="rounded-full border border-[var(--border)] bg-[var(--bg)]/45 px-3 py-2 text-[0.78rem] text-[var(--text-dim)]">
                      {item}
                    </code>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-dim)]">
                  Optional Full Stack and Beacon values include `MCRAFTR_BEACON_TOKEN`, `MCRAFTR_MINECRAFT_DATA`, `MCRAFTR_SCHEMATICS_DIR`, `MCRAFTR_ENTITY_PRESET_DIR`, `MCRAFTR_BLUEMAP_URL`, and `MCRAFTR_DYNMAP_URL`.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] p-6">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">More repo docs</p>
                <div className="mt-4 grid gap-3">
                  <a href={`${REPO_URL}/blob/main/INSTALL.md`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]">Install guide</a>
                  <a href={`${REPO_URL}/blob/main/INSTALL.md#platform-notes`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]">Deploy</a>
                  <a href={`${REPO_URL}/blob/main/README.md#configuration`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]">Configuration docs</a>
                  <a href={`${REPO_URL}/blob/main/.env.example`} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]">.env example</a>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] p-6">
                <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Extras</p>
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
              <h2 className="text-2xl font-bold sm:text-3xl lg:text-[2.45rem]">Quick answers with the full docs nearby</h2>
              <p className="mt-4 text-[1rem] leading-7 text-[var(--text-dim)]">
                This page gives you the short version. GitHub has the deeper write-up when you need it.
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
            <p className="text-[0.72rem] uppercase tracking-[0.16em] text-[var(--accent)]">Need the full source docs?</p>
            <h2 className="mt-2 text-2xl font-bold">Go straight to GitHub for the complete documentation and source.</h2>
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
              href={COFFEE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border)] px-5 py-3 text-sm font-semibold text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Coffee
            </a>
          </div>
        </div>
      </section>

      <PublicSiteFooter links={docsFooterLinks} tagline="Repo-backed docs for fast Minecraft server management." />
    </main>
  )
}
