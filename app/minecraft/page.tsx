import { nodeAuth } from '@/auth.node'
import MinecraftClientPage, { type TabId } from './MinecraftClientPage'

const VALID_TABS: TabId[] = ['dashboard', 'players', 'actions', 'worlds', 'terminal', 'admin', 'chat', 'settings']

function normalizeTab(raw: string | undefined, isAdmin: boolean): TabId {
  if (!raw) return 'dashboard'
  const tab = raw as TabId
  if (!VALID_TABS.includes(tab)) return 'dashboard'
  if ((tab === 'admin' || tab === 'terminal') && !isAdmin) return 'dashboard'
  return tab
}

export default async function MinecraftPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const session = await nodeAuth()
  const isAdmin = session?.role === 'admin'

  const params = await searchParams
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const initialTab = normalizeTab(tabParam, isAdmin)

  return <MinecraftClientPage initialTab={initialTab} initialRole={session?.role} />
}
