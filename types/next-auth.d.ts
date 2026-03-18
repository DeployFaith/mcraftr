import 'next-auth'

declare module 'next-auth' {
  interface Session {
    role?: 'admin' | 'user'
    hasServer?: boolean
    activeServerId?: string | null
    activeServerLabel?: string | null
    demoReadOnly?: boolean
  }
}
