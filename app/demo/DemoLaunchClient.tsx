'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Props = {
  returnTo: string
}

export default function DemoLaunchClient({ returnTo }: Props) {
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Preparing your temporary demo account...')
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const run = async () => {
      try {
        const launchRes = await fetch('/api/demo/launch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnTo }),
        })
        const launchBody = await launchRes.json().catch(() => ({}))
        if (!launchRes.ok || !launchBody?.ok) {
          throw new Error(typeof launchBody?.error === 'string' ? launchBody.error : 'Unable to prepare the demo account.')
        }

        setStatus('Signing you into the demo...')

        const csrfRes = await fetch('/api/auth/csrf')
        const { csrfToken } = await csrfRes.json()
        const body = new URLSearchParams({
          username: launchBody.username,
          password: launchBody.password,
          csrfToken,
          callbackUrl: launchBody.returnTo || returnTo,
        })

        const signInRes = await fetch('/api/auth/callback/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          redirect: 'follow',
        })

        if (signInRes.ok && !signInRes.url.includes('error=')) {
          window.location.href = launchBody.returnTo || returnTo
          return
        }

        throw new Error('The demo session could not be started.')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to start the demo.')
        setStatus('')
      }
    }

    void run()
  }, [returnTo])

  return (
    <div className="glass-card w-full max-w-md space-y-4 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-[var(--text)]">Opening the live demo</h1>
        <p className="text-sm leading-6 text-[var(--text-dim)]">
          We create or reuse a temporary demo account for this browser, sign you in automatically, and take you straight into Mcraftr.
        </p>
      </div>

      {status && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--text-dim)]">
          {status}
        </div>
      )}

      {error && (
        <div className="space-y-3">
          <div className="rounded-lg border border-[#7f1d1d] bg-[#2a0f0f] px-4 py-3 text-sm text-[#fca5a5]">
            {error}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full rounded-lg border border-[var(--accent-mid)] px-4 py-3 text-sm font-semibold text-[var(--accent)] transition-colors hover:border-[var(--accent)]"
            >
              Try Again
            </button>
            <Link
              href="/login"
              className="w-full rounded-lg border border-[var(--border)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-dim)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Go to Login
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
