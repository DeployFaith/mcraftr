import { nodeAuth } from '@/auth.node'
import { redirect } from 'next/navigation'
import MinecraftClientPage, { type TabId } from './MinecraftClientPage'
import { getActiveServer, getUserById } from '@/lib/users'

const VALID_TABS: TabId[] = ['dashboard', 'players', 'actions', 'worlds', 'terminal', 'admin', 'chat', 'settings']

function normalizeTab(raw: string | undefined, canAccessAdminPanels: boolean): TabId {
  if (!raw) return 'dashboard'
  const tab = raw as TabId
  if (!VALID_TABS.includes(tab)) return 'dashboard'
  if ((tab === 'admin' || tab === 'terminal') && !canAccessAdminPanels) return 'dashboard'
  return tab
}

export default async function MinecraftPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const session = await nodeAuth()
  if (!session?.user?.id || !getUserById(session.user.id)) {
    redirect('/login')
  }
  const canAccessAdminPanels = session?.role === 'admin'
  const stackMode = session?.user?.id ? (getActiveServer(session.user.id)?.stackMode ?? 'quick') : 'quick'

  const params = await searchParams
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const initialTab = normalizeTab(tabParam, canAccessAdminPanels)

  return <MinecraftClientPage initialTab={initialTab} initialRole={session?.role} initialStackMode={stackMode} />
}
