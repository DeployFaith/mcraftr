import type { Metadata } from 'next'
import { PublicSiteFooter, PublicSiteHeader } from '@/app/components/PublicSiteChrome'

const COFFEE_URL = 'https://buymeacoffee.com/deployfaith'
const REPO_URL = 'https://github.com/deployfaith/mcraftr'
const DEMO_URL = 'https://demo.mcraftr.deployfaith.xyz/demo?returnTo=%2Fminecraft'

export const metadata: Metadata = {
  title: 'Mcraftr Support',
  description: 'Placeholder page for the future Mcraftr Discord support invite.',
}

const navLinks = [
  { href: '/docs', label: 'Docs' },
  { href: '/', label: 'Home' },
]

const actionLinks = [
  { href: REPO_URL, label: 'GitHub', external: true },
  { href: DEMO_URL, label: 'Demo', external: true },
  { href: COFFEE_URL, label: 'Coffee', external: true },
  { href: '/support', label: 'Support' },
]

const footerLinks = [
  { href: '/docs', label: 'Docs' },
  { href: REPO_URL, label: 'GitHub', external: true },
  { href: DEMO_URL, label: 'Demo', external: true },
]

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <PublicSiteHeader
        navLinks={navLinks}
        actionLinks={actionLinks}
        mobilePrimaryLink={{ href: DEMO_URL, label: 'Demo', external: true }}
        mobileMenuLabel="Open support page menu"
      />

      <section className="px-4 pb-24 pt-16 sm:px-6 lg:pb-28 lg:pt-24">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--panel)] px-6 py-10 shadow-2xl sm:px-8 sm:py-12">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[var(--accent)]">Support</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl" style={{ fontFamily: 'var(--font-operator)' }}>
              Discord support is coming soon.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-dim)] sm:text-lg">
              This is a placeholder support page for a future Discord invite. For now, you can use the demo, browse the repo docs, or grab a Coffee link if you want to support the project directly.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-[var(--border)] px-6 py-3 text-sm font-semibold text-[var(--text-dim)] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                GitHub
              </a>
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-[var(--border)] bg-[var(--bg2)] px-6 py-3 text-sm font-semibold text-[var(--text)] transition-all hover:border-[var(--accent)]"
              >
                Demo
              </a>
              <a
                href={COFFEE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-6 py-3 text-sm font-semibold"
                style={{ backgroundColor: 'var(--accent)', color: 'var(--bg)' }}
              >
                Coffee
              </a>
            </div>
          </div>
        </div>
      </section>

      <PublicSiteFooter links={footerLinks} tagline="Repo-backed docs for fast Minecraft server management." />
    </main>
  )
}
