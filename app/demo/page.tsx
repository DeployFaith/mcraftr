import { redirect } from 'next/navigation'
import BrandLockup from '@/app/components/BrandLockup'
import { nodeAuth } from '@/auth.node'
import { normalizeDemoReturnTo } from '@/lib/demo-access'
import { getUserById } from '@/lib/users'
import DemoLaunchClient from './DemoLaunchClient'

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>
}) {
  const params = await searchParams
  const returnTo = normalizeDemoReturnTo(Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo)
  const session = await nodeAuth()

  if (session?.user?.id && getUserById(session.user.id)) {
    redirect(returnTo)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <BrandLockup size="hero" className="justify-center" />
          <p className="text-xs font-mono tracking-[0.18em] text-[var(--text-dim)]">instant live demo access</p>
        </div>
        <DemoLaunchClient returnTo={returnTo} />
      </div>
    </div>
  )
}
