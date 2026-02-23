import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getUserByEmail, getUserById, validatePassword } from '@/lib/users'
import { authConfig } from '@/auth'

// This file is Node.js only — it uses static imports of lib/users which
// depends on fs, crypto, better-sqlite3, etc. It must NEVER be imported
// by middleware.ts or any other Edge-bundled file.
//
// The API route handler at app/api/auth/[...nextauth]/route.ts imports
// handlers and signIn/signOut from here.

export const { handlers, auth: nodeAuth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const user = getUserByEmail(credentials.username as string)
        if (!user) return null
        if (!validatePassword(user, credentials.password as string)) return null
        return { id: user.id, name: user.email, email: user.email }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }: { token: any; user: any; trigger?: string }) {
      // On initial sign-in, persist the user id into the token.
      if (user?.id) {
        token.id = user.id
      }
      // Refresh hasServer and role on every JWT evaluation: sign-in, token
      // rotation, and explicit update() calls from the client. This ensures
      // that when a user saves a server via /connect, the next JWT issued
      // (triggered by useSession().update()) reflects hasServer=true without
      // requiring a full sign-out/sign-in cycle.
      if (token.id) {
        const u = getUserById(token.id as string)
        token.hasServer = !!u?.server
        token.role = u?.role ?? 'user'
      }
      return token
    },
  },
})
