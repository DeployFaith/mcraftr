import { redirect } from 'next/navigation'
import { nodeAuth } from '@/auth.node'
import { getUserById } from '@/lib/users'
import AdminTerminalWorkspace from '../components/AdminTerminalWorkspace'

export default async function MinecraftTerminalPage() {
  const session = await nodeAuth()
  const user = session?.user?.id ? getUserById(session.user.id) : null
  if (!session?.user?.id || !user) {
    redirect('/login')
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 pb-24">
      <div className="space-y-1">
        <div className="font-mono text-[12px] tracking-[0.18em] text-[var(--text-dim)]">SERVER TERMINAL</div>
        <div className="text-[14px] text-[var(--text-dim)]">Standalone terminal workspace for server command discovery, execution, docs, and favorites.</div>
      </div>
      <AdminTerminalWorkspace initialMode="popout" standalone readOnly={session.role !== 'admin'} relayEnabled={Boolean(user.activeServerId)} />
    </div>
  )
}
