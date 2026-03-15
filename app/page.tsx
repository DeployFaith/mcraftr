import type { Metadata } from 'next'
import Image, { type StaticImageData } from 'next/image'
import Link from 'next/link'
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
import BrandLockup from './components/BrandLockup'

export const metadata: Metadata = {
  title: 'Mcraftr - Minecraft Admin Panel',
  description: 'Mcraftr is a fast, self-hosted web interface for Minecraft server operations over RCON, with a richer Full Stack mode for world-aware tools.',
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
  { title: 'Dashboard', desc: 'Real-time overview of your server health, player count, and performance metrics at a glance.' },
  { title: 'Players', desc: 'View online players, manage bans, view inventories, and teleport between players instantly.' },
  { title: 'Actions', desc: 'Execute common commands—save-all, kick, ban, op, deop—with a single click. No typing required.' },
  { title: 'Worlds', desc: 'Browse all dimensions, manage chunks, view seed, and switch between worlds with world-aware tools.' },
  { title: 'Terminal', desc: 'Full RCON console in your browser. Run any command, see responses in real-time.' },
  { title: 'Admin', desc: 'Manage whitelist, ops, server properties, and advanced configuration without touching config files.' },
  { title: 'Chat', desc: 'Live chat feed with player messaging, history search, and moderation tools built in.' },
  { title: 'Settings', desc: 'Configure theme, accent color, server profiles, and UI preferences to match your style.' },
]

const faq = [
  {
    q: 'What is Mcraftr?',
    a: 'Mcraftr is a self-hosted Minecraft admin panel built for fast, opinionated server management over RCON. It gives you a web interface to manage your existing Minecraft server without replacing your host.'
  },
  {
    q: 'Do I need to change hosts?',
    a: 'No. Mcraftr sits in front of your existing server. It connects via RCON to whatever host you already use—whether it\'s a VPS, dedicated machine, or managed hosting.'
  },
  {
    q: 'What\'s the difference between Quick Connect and Full Stack?',
    a: 'Quick Connect gives you instant RCON access from any device. Full Stack adds world-aware tools, previews, catalogs, and a richer UI experience. Quick Connect works with almost any server; Full Stack unlocks more advanced features.'
  },
  {
    q: 'Is there a public demo?',
    a: 'Yes. Click "Open Demo" to try a live instance. No account required.'
  },
  {
    q: 'Is it open source?',
    a: 'Yes. Mcraftr is open source under the MIT license. Contributions welcome.'
  },
  {
    q: 'Who is Mcraftr for?',
    a: 'Server owners who want a clean, fast web interface instead of typing commands in-console. If you already run a Minecraft server and want easier day-to-day management, Mcraftr is built for you.'
  },
]

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-[var(--bg)]/80 border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <BrandLockup size="header" />
          
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors">Features</a>
            <a href="#modes" className="text-sm text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors">Modes</a>
            <a href="#screenshots" className="text-sm text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors">Screenshots</a>
            <a href="#install" className="text-sm text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors">Install</a>
            <a href="#faq" className="text-sm text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/deployfaith/mcraftr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
            >
              GitHub
            </a>
            <Link
              href="/login"
              className="text-sm px-4 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] transition-all"
            >
              Login
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6" style={{ fontFamily: 'var(--font-operator)' }}>
                <span className="text-[var(--accent)]">MCRAFTR</span>
                <br />
                <span className="text-[var(--text)]">Minecraft admin panel,</span>
                <br />
                <span className="text-[var(--text-dim)]">minus the clutter.</span>
              </h1>
              
              <p className="text-lg text-[var(--text-dim)] mb-8 max-w-xl">
                A fast, self-hosted web interface for Minecraft server operations over RCON. 
                Built for people who already run a server and want easier management—without the bloat.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <a
                  href="https://demo.mcraftr.deployfaith.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 text-base font-semibold rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-[0_0_30px_var(--accent-dim)]"
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
                  className="px-8 py-4 text-base font-semibold rounded-lg border-2 transition-all duration-200 hover:scale-105"
                  style={{ 
                    borderColor: 'var(--accent)', 
                    color: 'var(--accent)',
                  }}
                >
                  View on GitHub
                </a>
              </div>

              <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                {['Self-hosted', 'Open source', 'RCON-first', 'Quick Connect', 'Full Stack'].map((chip) => (
                  <span 
                    key={chip}
                    className="px-3 py-1 text-xs rounded-full bg-[var(--panel)] border border-[var(--border)] text-[var(--text-dim)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-[var(--accent)]/20 blur-3xl rounded-full" />
              <div className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
                <Image
                  src={dashboardShot}
                  alt="Mcraftr dashboard showing the authenticated app experience"
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
      <section className="py-20 px-4 sm:px-6 bg-[var(--bg2)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-[var(--text)]">
            Not a hosting panel. Just a better way to manage your server.
          </h2>
          <p className="text-lg text-[var(--text-dim)] leading-relaxed mb-8">
            Most Minecraft admin tools try to be everything—billing, provisioning, modpacks, backups, DNS. 
            Mcraftr does one thing well: give you a fast web interface to operate your server.
          </p>
          <p className="text-lg text-[var(--text-dim)] leading-relaxed">
            If you already have a server running and just want easier day-to-day management—player bans, 
            commands, chat moderation, world switching—Mcraftr fits right in. No migration required.
          </p>
        </div>
      </section>

      {/* Features Gallery */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-[var(--text)]">
            Everything you need to run your server
          </h2>
          <p className="text-center text-[var(--text-dim)] mb-12 max-w-2xl mx-auto">
            Eight built-in sections cover the full scope of server operations. 
            No plugins to install, no extra config. Just connect and go.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature) => (
              <div 
                key={feature.title}
                className="p-4 rounded-xl bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--accent)] transition-all duration-200 group"
              >
                <h3 className="text-lg font-semibold text-[var(--accent)] mb-2 group-hover:translate-x-1 transition-transform">
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--text-dim)]">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section id="screenshots" className="py-20 px-4 sm:px-6 bg-[var(--bg2)]">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 text-[var(--text)]">
            See it in action
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {screenshots.map((shot: ScreenshotItem, idx) => (
              <div 
                key={idx}
                className="group relative rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--panel)] hover:border-[var(--accent)] transition-all duration-200"
              >
                <div className="relative aspect-video">
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-[var(--bg)] to-transparent">
                  <span className="text-sm font-medium text-[var(--accent)]">{shot.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modes */}
      <section id="modes" className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4 text-[var(--text)]">
            Two ways to connect
          </h2>
          <p className="text-center text-[var(--text-dim)] mb-12">
            Choose the mode that fits your needs. Both work with your existing server.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--accent)] transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--text)]">Quick Connect</h3>
              </div>
              <p className="text-[var(--text-dim)] mb-4">
                The fastest path to your server. Enter host, port, and RCON password—get instant web access.
              </p>
              <ul className="space-y-2 text-sm text-[var(--text-dim)]">
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Works with any RCON-enabled server
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> No setup required beyond RCON
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Full terminal and command access
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Works great on mobile
                </li>
              </ul>
            </div>

            <div className="p-6 rounded-xl bg-[var(--panel)] border border-[var(--border)] hover:border-[var(--accent)] transition-all">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--text)]">Full Mcraftr Stack</h3>
              </div>
              <p className="text-[var(--text-dim)] mb-4">
                Richer experience with world-aware tools, previews, catalogs, and deeper integration.
              </p>
              <ul className="space-y-2 text-sm text-[var(--text-dim)]">
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> World management and switching
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Chunk browser and previews
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Player inventory viewer
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[var(--accent)]">✓</span> Advanced admin tools
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--bg2)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 text-[var(--text)]">
            Get started in minutes
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[var(--panel)] border border-[var(--border)] flex items-center justify-center">
                <span className="text-2xl font-bold text-[var(--accent)]">1</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Connect</h3>
              <p className="text-sm text-[var(--text-dim)]">
                Enter your server host, RCON port, and password. Enable RCON in server.properties if you haven't already.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[var(--panel)] border border-[var(--border)] flex items-center justify-center">
                <span className="text-2xl font-bold text-[var(--accent)]">2</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Choose Mode</h3>
              <p className="text-sm text-[var(--text-dim)]">
                Start with Quick Connect for instant access, or set up Full Stack for richer world-aware tools.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[var(--panel)] border border-[var(--border)] flex items-center justify-center">
                <span className="text-2xl font-bold text-[var(--accent)]">3</span>
              </div>
              <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Manage</h3>
              <p className="text-sm text-[var(--text-dim)]">
                Run commands, manage players, moderate chat, and control your server from any device in your browser.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started */}
      <section id="install" className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-[var(--text)]">
            Ready to try it?
          </h2>
          <p className="text-lg text-[var(--text-dim)] mb-8">
            Self-host it yourself or try the public demo. Either way, you're in control.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://demo.mcraftr.deployfaith.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 text-base font-semibold rounded-lg transition-all duration-200 hover:scale-105"
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
              className="px-8 py-4 text-base font-semibold rounded-lg border-2 transition-all duration-200 hover:scale-105"
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
      <section id="faq" className="py-20 px-4 sm:px-6 bg-[var(--bg2)]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 text-[var(--text)]">
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
      <footer className="py-8 px-4 sm:px-6 border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandLockup size="header" />
          </div>
          
          <div className="flex items-center gap-6">
            <a
              href="https://github.com/deployfaith/mcraftr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://demo.mcraftr.deployfaith.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors"
            >
              Demo
            </a>
          </div>

          <p className="text-xs text-[var(--text-dim)]">
            Open source. Self-hosted. Your server, your rules.
          </p>
        </div>
      </footer>
    </main>
  )
}
