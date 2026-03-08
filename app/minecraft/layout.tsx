import { auth } from '@/auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import BrandLockup from '@/app/components/BrandLockup'
import HeaderControls from './components/HeaderControls'

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
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6 md:gap-10">
          <Link href="/minecraft" className="shrink-0 pr-2 md:pr-4" aria-label="Return to Mcraftr dashboard">
            <BrandLockup size="header" />
          </Link>
          <div className="ml-auto">
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
