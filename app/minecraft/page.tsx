import { nodeAuth } from '@/auth.node'
import MinecraftClientPage, { type TabId } from './MinecraftClientPage'

const VALID_TABS: TabId[] = ['players', 'actions', 'admin', 'chat', 'settings']

function normalizeTab(raw: string | undefined, isAdmin: boolean): TabId {
  if (!raw) return 'players'
  const tab = raw as TabId
  if (!VALID_TABS.includes(tab)) return 'players'
  if (tab === 'admin' && !isAdmin) return 'players'
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

  return <MinecraftClientPage initialTab={initialTab} />
}
