import MinecraftClientPage, { type TabId } from './MinecraftClientPage'

const VALID_TABS: TabId[] = ['players', 'actions', 'admin', 'chat', 'settings']

function normalizeTab(raw: string | undefined): TabId {
  if (!raw) return 'players'
  return VALID_TABS.includes(raw as TabId) ? (raw as TabId) : 'players'
}

export default async function MinecraftPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const params = await searchParams
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab
  const initialTab = normalizeTab(tabParam)

  return <MinecraftClientPage initialTab={initialTab} />
}
