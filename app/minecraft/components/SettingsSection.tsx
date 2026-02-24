'use client'
import { useState, useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useTheme, ACCENTS } from '@/app/components/ThemeProvider'
import { FEATURE_DEFS, type FeatureKey } from '@/lib/features'
// ── Small helpers ─────────────────────────────────────────────────────────────

function StatusMsg({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div
      className="text-[13px] font-mono mt-2 px-3 py-2 rounded-lg border"
      style={{
        color: ok ? 'var(--accent)' : '#ff3355',
        borderColor: ok ? 'var(--accent-mid)' : '#ff335540',
        background: ok ? 'var(--accent-dim)' : '#ff335510',
      }}
    >
      {msg}
    </div>
  )
}

type FeatureFlags = Record<FeatureKey, boolean>

// ── Main component ────────────────────────────────────────────────────────────

export default function SettingsSection({ role: _role }: { role?: string }) {
  const [serverInfo, setServerInfo] = useState<{ host: string | null; port: number } | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const { theme, setTheme, accent, setAccent } = useTheme()

  // Feature flags state
  const [features, setFeatures] = useState<FeatureFlags | null>(null)
  const [featuresLoading, setFeaturesLoading] = useState(true)
  const [featuresSaving, setFeaturesSaving] = useState(false)
  const [featuresStatus, setFeaturesStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    fetch('/api/account/preferences').then(r => r.json()).then(d => {
      if (d.ok && d.features) setFeatures(d.features)
    }).catch(() => {}).finally(() => setFeaturesLoading(false))
  }, [])

  const toggleFeature = async (key: FeatureKey) => {
    if (!features || featuresSaving) return
    const newFeatures = { ...features, [key]: !features[key] }
    setFeatures(newFeatures)
    setFeaturesSaving(true)
    setFeaturesStatus(null)
    try {
      const res = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: newFeatures[key] }),
      })
      const d = await res.json()
      if (d.ok) {
        if (d.features) setFeatures(d.features)
        setFeaturesStatus({ ok: true, msg: 'Preferences saved' })
        window.dispatchEvent(new Event('mcraftr:features-updated'))
      } else {
        setFeatures(features)
        setFeaturesStatus({ ok: false, msg: d.error || 'Failed to save' })
      }
    } catch {
      setFeatures(features)
      setFeaturesStatus({ ok: false, msg: 'Network error' })
    } finally { setFeaturesSaving(false) }
  }

  // Change password state
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwStatus, setPwStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  // Change email state
  const [emailNew, setEmailNew] = useState('')
  const [emailPw, setEmailPw] = useState('')
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePw, setDeletePw] = useState('')
  const [deleteStatus, setDeleteStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    fetch('/api/server').then(r => r.json()).then(d => {
      if (d.ok && d.host) setServerInfo({ host: d.host, port: d.port ?? 25575 })
    }).catch(() => {})
  }, [])

  const disconnectServer = async () => {
    if (!confirm('Disconnect this server? You will need to reconnect to use Mcraftr.')) return
    setDisconnecting(true)
    try {
      await fetch('/api/server', { method: 'DELETE' })
      window.location.href = '/connect'
    } catch {
      alert('Failed to disconnect. Please try again.')
      setDisconnecting(false)
    }
  }

  // ── Change password ─────────────────────────────────────────────────────────

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwStatus(null)
    if (pwNew !== pwConfirm) {
      setPwStatus({ ok: false, msg: 'New passwords do not match' })
      return
    }
    if (pwNew.length < 8) {
      setPwStatus({ ok: false, msg: 'New password must be at least 8 characters' })
      return
    }
    setPwLoading(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      })
      const data = await res.json()
      if (data.ok) {
        setPwStatus({ ok: true, msg: 'Password updated successfully' })
        setPwCurrent(''); setPwNew(''); setPwConfirm('')
      } else {
        setPwStatus({ ok: false, msg: data.error || 'Failed to update password' })
      }
    } catch {
      setPwStatus({ ok: false, msg: 'Network error — please try again' })
    } finally {
      setPwLoading(false)
    }
  }

  // ── Change email ────────────────────────────────────────────────────────────

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailStatus(null)
    setEmailLoading(true)
    try {
      const res = await fetch('/api/account/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailNew, currentPassword: emailPw }),
      })
      const data = await res.json()
      if (data.ok) {
        setEmailStatus({ ok: true, msg: `Email updated to ${data.email}. Sign in again with your new email.` })
        setEmailNew(''); setEmailPw('')
      } else {
        setEmailStatus({ ok: false, msg: data.error || 'Failed to update email' })
      }
    } catch {
      setEmailStatus({ ok: false, msg: 'Network error — please try again' })
    } finally {
      setEmailLoading(false)
    }
  }

  // ── Delete account ──────────────────────────────────────────────────────────

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeleteStatus(null)
    setDeleteLoading(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: deletePw }),
      })
      const data = await res.json()
      if (data.ok) {
        await signOut({ callbackUrl: '/login' })
      } else {
        setDeleteStatus({ ok: false, msg: data.error || 'Failed to delete account' })
        setDeleteLoading(false)
      }
    } catch {
      setDeleteStatus({ ok: false, msg: 'Network error — please try again' })
      setDeleteLoading(false)
    }
  }

  // ── Shared input style ──────────────────────────────────────────────────────

  const inputCls = 'w-full px-3 py-2 rounded-lg font-mono text-[13px] bg-[var(--panel)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-mid)] transition-colors'
  const btnPrimary = 'px-4 py-2 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border'

  return (
    <div className="space-y-4">
      <h2 className="font-mono text-base tracking-widest text-[var(--accent)]">SETTINGS</h2>

      {/* Appearance */}
      <div className="glass-card p-5 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">APPEARANCE</div>

        <div>
          <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-2">THEME</div>
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className="flex-1 py-2 rounded-lg font-mono text-[13px] tracking-widest transition-all border"
                style={theme === t ? {
                  borderColor: 'var(--accent)',
                  background: 'var(--accent-dim)',
                  color: 'var(--accent)',
                } : {
                  borderColor: 'var(--border)',
                  color: 'var(--text-dim)',
                }}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-2">ACCENT COLOR</div>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map(a => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                title={a.label}
                className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center"
                style={{
                  background: a.color,
                  borderColor: accent === a.id ? 'var(--text)' : 'transparent',
                  boxShadow: accent === a.id ? `0 0 8px ${a.color}` : 'none',
                }}
              >
                {accent === a.id && (
                  <span className="text-[13px] font-bold" style={{ color: '#000', mixBlendMode: 'multiply' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="glass-card p-5 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">FEATURE TOGGLES</div>
        <div className="text-[11px] font-mono text-[var(--text-dim)] opacity-60 mb-2">
          Turn off features you don't need. Admins can also restrict features for other users.
        </div>
        {featuresLoading ? (
          <div className="text-[13px] font-mono text-[var(--text-dim)] animate-pulse">Loading...</div>
        ) : (
          <div className="space-y-2">
            {FEATURE_DEFS.map(f => (
              <div key={f.key} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[var(--panel)] border border-[var(--border)]">
                <div className="min-w-0">
                  <div className="text-[13px] font-mono text-[var(--text)]">{f.label}</div>
                  <div className="text-[11px] font-mono text-[var(--text-dim)]">{f.desc}</div>
                </div>
                <button
                  onClick={() => toggleFeature(f.key)}
                  disabled={featuresSaving}
                  className={`w-12 h-6 rounded-full transition-all border ${
                    features?.[f.key]
                      ? 'border-[var(--accent-mid)] bg-[var(--accent-dim)]'
                      : 'border-[var(--border)] bg-[var(--bg)]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full transition-all shadow-sm ${
                      features?.[f.key]
                        ? 'translate-x-6'
                        : 'translate-x-0.5'
                    }`}
                    style={{
                      background: features?.[f.key] ? 'var(--accent)' : 'var(--text-dim)',
                    }}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
        {featuresStatus && (
          <div className={`text-[11px] font-mono px-2 py-1 rounded ${
            featuresStatus.ok
              ? 'text-[var(--accent)] bg-[var(--accent-dim)]'
              : 'text-red-400 bg-red-950/30'
          }`}>
            {featuresStatus.msg}
          </div>
        )}
      </div>

      {/* Server connection info */}
      <div className="glass-card p-5 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">SERVER CONNECTION</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--panel)] rounded-lg p-3 border border-[var(--border)]">
            <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-1">HOST</div>
            <div className="text-[13px] font-mono text-[var(--text)] truncate">{serverInfo?.host ?? '—'}</div>
          </div>
          <div className="bg-[var(--panel)] rounded-lg p-3 border border-[var(--border)]">
            <div className="text-[13px] font-mono text-[var(--text-dim)] tracking-widest mb-1">RCON PORT</div>
            <div className="text-[13px] font-mono text-[var(--text)]">{serverInfo?.port ?? '—'}</div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <a
            href="/connect?edit=1"
            className="flex-1 py-2.5 rounded-lg font-mono text-[13px] tracking-widest text-center transition-all border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)]"
          >
            Edit Connection
          </a>
          <button
            onClick={disconnectServer}
            disabled={disconnecting}
            className="flex-1 py-2.5 rounded-lg font-mono text-[13px] tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed border border-red-900 text-red-400 hover:border-red-700"
          >
            {disconnecting ? 'Disconnecting...' : 'Disconnect Server'}
          </button>
        </div>
      </div>

      {/* Account — Change Password */}
      <div className="glass-card p-5 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">ACCOUNT — CHANGE PASSWORD</div>
        <form onSubmit={handleChangePassword} className="space-y-2">
          <input
            type="password"
            placeholder="Current password"
            value={pwCurrent}
            onChange={e => setPwCurrent(e.target.value)}
            className={inputCls}
            required
            autoComplete="current-password"
          />
          <input
            type="password"
            placeholder="New password (min 8 chars)"
            value={pwNew}
            onChange={e => setPwNew(e.target.value)}
            className={inputCls}
            required
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={pwConfirm}
            onChange={e => setPwConfirm(e.target.value)}
            className={inputCls}
            required
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={pwLoading}
            className={btnPrimary}
            style={{ borderColor: 'var(--accent-mid)', color: 'var(--accent)', background: 'var(--accent-dim)' }}
          >
            {pwLoading ? 'Updating...' : 'Update Password'}
          </button>
          {pwStatus && <StatusMsg ok={pwStatus.ok} msg={pwStatus.msg} />}
        </form>
      </div>

      {/* Account — Change Email */}
      <div className="glass-card p-5 space-y-4">
        <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">ACCOUNT — CHANGE EMAIL</div>
        <form onSubmit={handleChangeEmail} className="space-y-2">
          <input
            type="email"
            placeholder="New email address"
            value={emailNew}
            onChange={e => setEmailNew(e.target.value)}
            className={inputCls}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Confirm with current password"
            value={emailPw}
            onChange={e => setEmailPw(e.target.value)}
            className={inputCls}
            required
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={emailLoading}
            className={btnPrimary}
            style={{ borderColor: 'var(--accent-mid)', color: 'var(--accent)', background: 'var(--accent-dim)' }}
          >
            {emailLoading ? 'Updating...' : 'Update Email'}
          </button>
          {emailStatus && <StatusMsg ok={emailStatus.ok} msg={emailStatus.msg} />}
        </form>
      </div>

      {/* Account — Danger Zone */}
      <div className="glass-card p-5 space-y-3" style={{ borderColor: '#ff335530' }}>
        <div className="text-[13px] font-mono tracking-widest text-red-500">DANGER ZONE</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-mono text-[var(--text)]">Delete Account</div>
            <div className="text-[13px] font-mono text-[var(--text-dim)] mt-0.5">Permanently removes your account and all data. This cannot be undone.</div>
          </div>
          <button
            onClick={() => { setShowDeleteModal(true); setDeleteStatus(null); setDeletePw('') }}
            className="px-3 py-1.5 rounded-lg font-mono text-[13px] border border-red-900 text-red-400 hover:border-red-700 transition-colors flex-shrink-0 ml-4"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="glass-card p-6 w-full max-w-sm space-y-4" style={{ borderColor: '#ff335540' }}>
            <div className="text-[15px] font-mono text-red-400 tracking-widest">DELETE ACCOUNT</div>
            <p className="text-[13px] font-mono text-[var(--text-dim)]">
              This is permanent. All your data, server connections, and settings will be erased. Enter your password to confirm.
            </p>
            <form onSubmit={handleDeleteAccount} className="space-y-3">
              <input
                type="password"
                placeholder="Your password"
                value={deletePw}
                onChange={e => setDeletePw(e.target.value)}
                className={inputCls}
                required
                autoFocus
                autoComplete="current-password"
              />
              {deleteStatus && <StatusMsg ok={deleteStatus.ok} msg={deleteStatus.msg} />}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2 rounded-lg font-mono text-[13px] border border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--accent-mid)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading}
                  className="flex-1 py-2 rounded-lg font-mono text-[13px] border border-red-800 text-red-400 hover:border-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
