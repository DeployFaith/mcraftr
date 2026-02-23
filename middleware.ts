import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl } = req
  const session = req.auth

  // Allow public routes through unconditionally
  const publicPaths = ['/login', '/register', '/api/auth']
  if (publicPaths.some(p => nextUrl.pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Not signed in — redirect to login
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Check if user has a server configured via the JWT hasServer flag only.
  // The mcraftr_has_server cookie is NOT trusted here — it is unsigned and
  // could be forged by any authenticated user to bypass this gate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasServer = (session as any)?.hasServer as boolean | undefined

  if (!hasServer
    && nextUrl.pathname !== '/connect'
    && !nextUrl.pathname.startsWith('/api/server')
  ) {
    return NextResponse.redirect(new URL('/connect', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|api/auth).*)'],
}
