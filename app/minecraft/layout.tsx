import { auth } from '@/auth'
import { signOut } from '@/auth.node'
import { redirect } from 'next/navigation'

export default async function MinecraftLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top header */}
      <header
        className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-md"
        style={{ background: 'rgba(10,10,15,0.85)' }}
      >
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <span className="font-mono font-bold tracking-widest text-sm" style={{ color: 'var(--accent)' }}>
            MCRAFTR
          </span>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-[var(--text-dim)] hidden sm:block">
              {session.user.email ?? session.user.name}
            </span>
            <form action={async () => {
              'use server'
              await signOut({ redirectTo: '/login' })
            }}>
              <button
                type="submit"
                className="text-[10px] font-mono text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors border border-[var(--border)] px-2.5 py-1 rounded hover:border-[var(--accent-mid)]"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Page content — includes bottom nav on mobile */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
