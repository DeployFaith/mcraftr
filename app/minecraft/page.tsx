import { nodeAuth } from '@/auth.node'
import MinecraftClientPage, { type TabId } from './MinecraftClientPage'
import { getActiveServer } from '@/lib/users'
import { type ServerStackMode } from '@/lib/server-stack'

const VALID_TABS: TabId[] = ['dashboard', 'players', 'actions', 'worlds', 'terminal', 'admin', 'chat', 'settings']

function normalizeTab(raw: string | undefined, isAdmin: boolean, stackMode: ServerStackMode): TabId {
  if (!raw) return 'dashboard'
  const tab = raw as TabId
  if (!VALID_TABS.includes(tab)) return 'dashboard'
  if ((tab === 'admin' || tab === 'terminal') && !isAdmin) return 'dashboard'
  if (tab === 'worlds' && stackMode === 'quick') return 'dashboard'
  return tab
}

export default async function MinecraftPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const session = await nodeAuth()
  const isAdmin = session?.role === 'admin'
  const stackMode = session?.user?.id ? (getActiveServer(session.user.id)?.stackMode ?? 'quick') : 'quick'

  const params = await searchParams
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const initialTab = normalizeTab(tabParam, isAdmin, stackMode)

  return <MinecraftClientPage initialTab={initialTab} initialRole={session?.role} initialStackMode={stackMode} />
}
