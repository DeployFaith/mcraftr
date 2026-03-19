import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Image, { type StaticImageData } from 'next/image'
import { redirect } from 'next/navigation'
import loginShot from '@/docs/screenshots/highlights/01-login.png'
import connectShot from '@/docs/screenshots/highlights/02-connect.png'
import dashboardShot from '@/docs/screenshots/highlights/03-dashboard.png'
import playersShot from '@/docs/screenshots/highlights/04-players.png'
import actionsShot from '@/docs/screenshots/highlights/05-actions.png'
import worldsShot from '@/docs/screenshots/highlights/06-worlds.png'
import terminalShot from '@/docs/screenshots/highlights/07-terminal.png'
import adminShot from '@/docs/screenshots/highlights/08-admin.png'
import chatShot from '@/docs/screenshots/highlights/09-chat.png'
import settingsShot from '@/docs/screenshots/highlights/10-settings.png'
import ProgressiveScreenshot from './components/ProgressiveScreenshot'
import { PUBLIC_SITE_DEMO_URL, PUBLIC_SITE_HEADER_ACTIONS, PUBLIC_SITE_REPO_URL, PublicSiteFooter, PublicSiteHeader } from './components/PublicSiteChrome'

const REPO_URL = PUBLIC_SITE_REPO_URL
const DEMO_LAUNCH_URL = PUBLIC_SITE_DEMO_URL.replace('?returnTo=%2Fminecraft', '')
const README_URL = `${REPO_URL}/blob/main/README.md`
const INSTALL_URL = `${REPO_URL}/blob/main/INSTALL.md`

function demoLaunchHref(returnTo = '/minecraft') {
  return `${DEMO_LAUNCH_URL}?returnTo=${encodeURIComponent(returnTo)}`
}

export const metadata: Metadata = {
  title: 'Mcraftr',
  description: 'Self-hosted Minecraft admin panel for fast, opinionated server management over RCON.',
  icons: {
    icon: '/m.svg',
    shortcut: '/m.svg',
    apple: '/m.svg',
  },
  alternates: {
    canonical: 'https://mcraftr.deployfaith.xyz/',
  },
  openGraph: {
    type: 'website',
    url: 'https://mcraftr.deployfaith.xyz/',
    title: 'Mcraftr',
    description: 'Self-hosted Minecraft admin panel for fast, opinionated server management over RCON.',
    images: [
      {
        url: 'https://mcraftr.deployfaith.xyz/social-card-v2.png',
        width: 1200,
        height: 630,
        alt: 'Mcraftr social preview card',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mcraftr',
    description: 'Self-hosted Minecraft admin panel for fast, opinionated server management over RCON.',
    images: ['https://mcraftr.deployfaith.xyz/social-card-v2.png'],
  },
}

const screenshots = [
  { src: loginShot, alt: 'Mcraftr login screen', label: 'Login' },
  { src: connectShot, alt: 'Mcraftr server connect flow', label: 'Connect' },
  { src: dashboardShot, alt: 'Mcraftr dashboard overview', label: 'Dashboard' },
  { src: playersShot, alt: 'Mcraftr player management', label: 'Players' },
  { src: actionsShot, alt: 'Mcraftr server actions', label: 'Actions' },
  { src: worldsShot, alt: 'Mcraftr world management', label: 'Worlds' },
  { src: terminalShot, alt: 'Mcraftr RCON terminal', label: 'Terminal' },
  { src: adminShot, alt: 'Mcraftr admin tools', label: 'Admin' },
  { src: chatShot, alt: 'Mcraftr chat moderation', label: 'Chat' },
  { src: settingsShot, alt: 'Mcraftr settings panel', label: 'Settings' },
]

type ScreenshotItem = {
  src: StaticImageData
  alt: string
  label: string
}

const features = [
  { title: 'Dashboard', desc: 'See server state, player activity, and the signals that matter before something turns into a problem.' },
  { title: 'Players', desc: 'Check who is online, inspect player state, and move straight into moderation or admin actions.' },
  { title: 'Actions', desc: 'Keep the routine commands one click away when you do not want to type the same RCON sequence again.' },
  { title: 'Worlds', desc: 'Work with world-specific context instead of handling the whole server through one flat command surface.' },
  { title: 'Terminal', desc: 'Use raw RCON when you need full control, then get back to the rest of the UI.' },
  { title: 'Admin', desc: 'Keep ops, whitelist, properties, and server controls in one place that is actually organized.' },
  { title: 'Chat', desc: 'Watch chat live and moderate without living in game or tailing logs.' },
  { title: 'Settings', desc: 'Tune the interface and saved-server behavior without digging through scattered config.' },
]

const galleryHighlights = [
  {
    src: dashboardShot,
    alt: 'Mcraftr dashboard overview',
    title: 'Dashboard',
    desc: 'Current status, player count, TPS, weather, and time.',
    href: `${README_URL}#dashboard`,
  },
  {
    src: playersShot,
    alt: 'Mcraftr players view',
    title: 'Players',
    desc: 'Live players, vitals, effects, location, and inventory.',
    href: `${README_URL}#players`,
  },
  {
    src: worldsShot,
    alt: 'Mcraftr worlds view',
    title: 'Worlds',
    desc: 'Full Stack worlds, structures, entities, maps, and richer workflows.',
    href: `${INSTALL_URL}#option-3-full-mcraftr-stack-with-docker-compose`,
  },
  {
    src: terminalShot,
    alt: 'Mcraftr terminal view',
    title: 'Terminal',
    desc: 'Admin terminal, schedules, audit history, and user controls.',
    href: `${README_URL}#admin`,
  },
]

const faq = [
  {
    q: 'What is Mcraftr?',
    a: 'Mcraftr is a self-hosted Minecraft admin panel for fast server management over RCON.'
  },
  {
    q: 'Do I need to change hosts?',
    a: 'No. It sits in front of the server you already run, as long as you can reach it over RCON.'
  },
  {
    q: 'What is the difference between Quick Connect and Full Mcraftr Stack?',
    a: 'Quick Connect is the shortest RCON-first path. Full Mcraftr Stack adds richer tools and more server context.'
  },
  {
    q: 'Is there a public demo?',
    a: 'Yes. The demo link opens a live public instance.'
  },
  {
    q: 'Is it open source?',
    a: 'Yes. The source is on GitHub.'
  },
  {
    q: 'Who is Mcraftr for?',
    a: 'People who already run Minecraft servers and want a better operations interface than raw console or a bloated host panel.'
  },
]

const navLinks = [
  { href: '/docs', label: 'Docs' },
  { href: '#features', label: 'Features' },
  { href: '#modes', label: 'Modes' },
  { href: '#screenshots', label: 'Screenshots' },
  { href: '#install', label: 'Install' },
  { href: '#faq', label: 'FAQ' },
]

const footerLinks = [
  { href: '/docs', label: 'Docs' },
  { href: 'https://github.com/deployfaith/mcraftr', label: 'GitHub', external: true },
  { href: demoLaunchHref(), label: 'Demo', external: true },
]

export default async function Home() {
  const host = (await headers()).get('host')?.toLowerCase() ?? ''

  if (host === 'demo.mcraftr.deployfaith.xyz') {
    redirect('/demo')
  }

  if (host === 'mcraftr.mesh') {
    redirect('/login')
  }

  return (
    <main className="min-h-screen">
      <PublicSiteHeader
        navLinks={navLinks}
        actionLinks={PUBLIC_SITE_HEADER_ACTIONS}
        mobileMenuLabel="Open landing page menu"
      />

      {/* Hero */}
      <section className="px-4 pb-20 pt-14 sm:px-6 sm:pb-24 sm:pt-18 lg:pb-28 lg:pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] lg:gap-14 xl:gap-18">
            <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:max-w-xl lg:text-left">
              <h1 className="mb-5 text-[2.35rem] font-bold leading-[0.94] sm:text-5xl lg:text-[4.25rem] lg:tracking-[-0.05em]" style={{ fontFamily: 'var(--font-operator)' }}>
                <span className="text-[var(--accent)]">Run your Minecraft server</span>
                <br />
                <span className="text-[var(--text-dim)]">without the panel bloat.</span>
              </h1>
              
              <p className="mx-auto mb-8 max-w-xl text-[1.04rem] leading-7 text-[var(--text-dim)] sm:text-lg lg:mx-0 lg:max-w-lg">
                Mcraftr is a self-hosted admin panel for Minecraft servers. It gives you a fast, opinionated web UI over RCON, with the full Mcraftr Stack available when you want more context.
              </p>

              <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
                <a
                  href={demoLaunchHref()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-lg px-6 py-4 text-base font-semibold transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_30px_var(--accent-dim)] sm:w-auto sm:px-8 sm:hover:scale-105"
                  style={{ 
                    backgroundColor: 'var(--accent)', 
                    color: 'var(--bg)',
                  }}
                >
                  Open Demo
                </a>
                
                <a
                  href="https://github.com/deployfaith/mcraftr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-lg border-2 px-6 py-4 text-base font-semibold transition-all duration-200 hover:scale-[1.02] sm:w-auto sm:px-8 sm:hover:scale-105"
                  style={{ 
                    borderColor: 'var(--accent)', 
                    color: 'var(--accent)',
                  }}
                >
                  View on GitHub
                </a>
              </div>

            </div>

            <div className="relative mx-auto w-full max-w-[640px] lg:mr-0 lg:max-w-[560px] lg:-translate-x-[55px] lg:-translate-y-[145px]">
              <div className="absolute inset-3 rounded-[1.5rem] bg-[var(--accent)]/16 blur-3xl sm:inset-6 sm:rounded-[2rem]" />
              <div className="relative overflow-hidden rounded-[1.6rem] border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
                <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg2)]/80 px-3 py-3 sm:px-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff7f7f]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffd76e]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]/80" />
                  <span className="ml-auto text-[0.6rem] uppercase tracking-[0.14em] text-[var(--text-dim)] sm:text-[0.68rem] sm:tracking-[0.16em]">App Preview</span>
                </div>
                <Image
                  src={dashboardShot}
                  alt="Actual in-product screen from Mcraftr"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="w-full h-auto"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Mcraftr */}
      <section className="bg-[var(--bg2)] px-4 py-24 sm:px-6 lg:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="mb-6 text-2xl font-bold text-[var(--text)] sm:text-3xl lg:text-[2.45rem]">
            For running the server, not babysitting a host panel.
          </h2>
          <p className="mb-7 text-lg leading-8 text-[var(--text-dim)]">
            Most tools in this space drift into hosting software. Billing, provisioning, DNS, backups, account sprawl. Mcraftr stays on the operator side of the job: players, commands, chat, worlds, and server control.
          </p>
          <p className="text-lg leading-8 text-[var(--text-dim)]">
            If you already run a server and want a sharper interface for players, commands, chat, and day-to-day admin work, Mcraftr fits right in. No migration. No extra panel noise.
          </p>
        </div>
      </section>

      {/* Features Gallery */}
      <section id="features" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="max-w-6xl mx-auto">
          <h2 className="mb-4 text-center text-2xl font-bold text-[var(--text)] sm:text-3xl lg:text-[2.35rem]">
            Everything you need to run your server
          </h2>
          <p className="mx-auto mb-14 max-w-2xl text-center text-[1rem] leading-7 text-[var(--text-dim)] sm:text-[1.05rem]">
            Core admin surfaces, without the detour through console every five minutes.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {features.map((feature) => (
              <div 
                key={feature.title}
                className="group rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-5 transition-all duration-200 hover:border-[var(--accent)]"
              >
                <h3 className="mb-3 text-lg font-semibold text-[var(--accent)] transition-transform group-hover:translate-x-1">
                  {feature.title}
                </h3>
                <p className="text-sm leading-6 text-[var(--text-dim)]">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section id="screenshots" className="scroll-mt-24 bg-[var(--bg2)] px-4 py-24 sm:px-6 lg:py-28">
        <div className="max-w-6xl mx-auto">
          <h2 className="mb-4 text-center text-2xl font-bold text-[var(--text)] sm:text-3xl lg:text-[2.35rem]">
            See it in action
          </h2>
          <p className="mx-auto mb-14 max-w-2xl text-center text-[1rem] leading-7 text-[var(--text-dim)] sm:text-[1.05rem]">
            Real screens from the product. No mockups. No fake dashboards.
          </p>

          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
            {galleryHighlights.map((highlight) => {
              return (
                <a
                  key={highlight.title}
                  href={highlight.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col overflow-hidden rounded-[1.4rem] border border-[var(--border)] bg-[var(--panel)] transition-all duration-200 hover:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg2)]"
                >
                  <div className="relative shrink-0 aspect-[16/10] overflow-hidden border-b border-[var(--border)] bg-[var(--bg)]/50">
                    <ProgressiveScreenshot
                      src={highlight.src}
                      alt={highlight.alt}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="h-full w-full scale-[1.12] object-cover object-top group-hover:scale-[1.15]"
                    />
                  </div>
                  <div className="relative z-[1] space-y-2 px-5 pb-5 pt-[60px]">
                    <div className="flex flex-col items-start justify-between gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-base font-semibold text-[var(--accent)]">{highlight.title}</span>
                      <span className="text-[0.68rem] uppercase tracking-[0.14em] text-[var(--text-dim)]">Open docs on GitHub</span>
                    </div>
                    <p className="max-w-[34ch] text-sm leading-6 text-[var(--text-dim)]">{highlight.desc}</p>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </section>

      {/* Modes */}
      <section id="modes" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="max-w-5xl mx-auto">
          <h2 className="mb-4 text-center text-2xl font-bold text-[var(--text)] sm:text-3xl lg:text-[2.35rem]">
            Two ways to connect
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[1rem] leading-7 text-[var(--text-dim)] sm:text-[1.05rem]">
            Pick the connection model that matches your setup.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 transition-all hover:border-[var(--accent)] lg:p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--text)]">Quick Connect</h3>
              </div>
              <p className="mb-5 text-[var(--text-dim)] leading-7">
                Connect over RCON and start managing the server from the web in a minute.
              </p>
              <ul className="space-y-2 text-sm text-[var(--text-dim)]">
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Works with standard RCON setups
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> No extra services to stand up
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Easy to access from desktop or mobile
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Short setup, broad compatibility
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 transition-all hover:border-[var(--accent)] lg:p-7">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--text)]">Full Mcraftr Stack</h3>
              </div>
              <p className="mb-5 text-[var(--text-dim)] leading-7">
                Adds world-aware tools, previews, catalogs, and deeper context beyond raw RCON.
              </p>
              <ul className="space-y-2 text-sm text-[var(--text-dim)]">
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> World-aware tools and views
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Previews with more operational context
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Better fit for regular operators
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Built for day-to-day server operations
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[var(--bg2)] px-4 py-24 sm:px-6 lg:py-28">
        <div className="max-w-4xl mx-auto">
          <h2 className="mb-4 text-center text-2xl font-bold text-[var(--text)] sm:text-3xl lg:text-[2.35rem]">
            Get connected and get to work
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-[1rem] leading-7 text-[var(--text-dim)] sm:text-[1.05rem]">
            Three steps. No host panel detour.
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center lg:p-7">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)]/30">
                <span className="text-2xl font-bold text-[var(--accent)]">1</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Connect your server</h3>
              <p className="text-sm text-[var(--text-dim)]">
                Point Mcraftr at the server you already run and connect over RCON.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center lg:p-7">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)]/30">
                <span className="text-2xl font-bold text-[var(--accent)]">2</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Pick your mode</h3>
              <p className="text-sm leading-6 text-[var(--text-dim)]">
                Start with Quick Connect or use Full Mcraftr Stack when you want the richer toolset.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-6 text-center lg:p-7">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg)]/30">
                <span className="text-2xl font-bold text-[var(--accent)]">3</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Run the server</h3>
              <p className="text-sm leading-6 text-[var(--text-dim)]">
                Handle commands, players, chat, and admin work from a web UI that stays focused.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started */}
      <section id="install" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="mb-5 text-2xl font-bold text-[var(--text)] sm:text-3xl lg:text-[2.35rem]">
            Try it or run it yourself
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-7 text-[var(--text-dim)]">
            Open the public demo to try the interface, or head to GitHub for install details and self-hosting.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <a
              href={demoLaunchHref()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-lg px-6 py-4 text-base font-semibold transition-all duration-200 hover:scale-[1.02] sm:w-auto sm:px-8 sm:hover:scale-105"
              style={{ 
                backgroundColor: 'var(--accent)', 
                color: 'var(--bg)',
              }}
            >
              Open Demo
            </a>
            
            <a
              href="https://github.com/deployfaith/mcraftr"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-lg border-2 px-6 py-4 text-base font-semibold transition-all duration-200 hover:scale-[1.02] sm:w-auto sm:px-8 sm:hover:scale-105"
              style={{ 
                borderColor: 'var(--accent)', 
                color: 'var(--accent)',
              }}
            >
              Self-Host on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24 bg-[var(--bg2)] px-4 py-24 sm:px-6 lg:py-28">
        <div className="max-w-3xl mx-auto">
          <h2 className="mb-10 text-center text-2xl font-bold text-[var(--text)] sm:text-3xl lg:text-[2.35rem]">
            Frequently asked questions
          </h2>

          <div className="space-y-4">
            {faq.map((item, idx) => (
              <details 
                key={idx}
                className="group rounded-lg bg-[var(--panel)] border border-[var(--border)] overflow-hidden"
              >
                <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
                  <span className="font-medium text-[var(--text)]">{item.q}</span>
                  <span className="text-[var(--accent)] group-open:rotate-180 transition-transform">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </summary>
                <div className="px-4 pb-4 text-[var(--text-dim)] text-sm leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicSiteFooter links={footerLinks} tagline="Open source. Self-hosted. Built for server ops." />
    </main>
  )
}
