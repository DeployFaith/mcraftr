import { auth } from '@/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import BrandLockup from '@/app/components/BrandLockup'
import { getUserById } from '@/lib/users'
import HeaderControls from './components/HeaderControls'

export default async function MinecraftLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!session.user.id || !getUserById(session.user.id)) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Top header */}
      <header
        className="sticky top-0 z-40 border-b border-[var(--border)] backdrop-blur-md"
        style={{ background: 'rgba(10,10,15,0.85)' }}
      >
        <div className="relative mx-auto h-14 w-full max-w-6xl px-4 sm:px-5">
          <Link
            href="/minecraft"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            aria-label="Return to Mcraftr dashboard"
          >
            <BrandLockup size="header" />
          </Link>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 pr-1 sm:pr-0">
            <HeaderControls />
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
