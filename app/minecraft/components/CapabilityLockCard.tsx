'use client'

import Link from 'next/link'
import { LockKeyhole, RadioTower, Telescope } from 'lucide-react'
import { FULL_STACK_DOCS_URL } from '@/lib/docs-links'

type Requirement = 'relay' | 'beacon' | 'full'

const COPY: Record<Requirement, { badge: string; title: string; summary: string; bullets: string[] }> = {
  relay: {
    badge: 'REQUIRES RELAY',
    title: 'This feature uses Mcraftr Relay',
    summary: 'Relay is Mcraftr\'s live integration layer for structured server operations.',
    bullets: [
      'Install or configure a Relay API integration on your Minecraft server',
      'Set the Relay Prefix in Connect',
      'Keep using Quick Connect for the raw RCON basics in the meantime',
    ],
  },
  beacon: {
    badge: 'REQUIRES BEACON',
    title: 'This feature uses Mcraftr Beacon',
    summary: 'Beacon is Mcraftr\'s read-only data layer for worlds, structures, plugins, maps, and related metadata.',
    bullets: [
      'Run Beacon as part of your Mcraftr deployment',
      'Mount your Minecraft data directory read-only into Beacon',
      'Save the Beacon URL in Connect to unlock these surfaces',
    ],
  },
  full: {
    badge: 'REQUIRES FULL STACK',
    title: 'This feature uses the Full Mcraftr Stack',
    summary: 'Full Stack combines RCON, Relay, and Beacon for the complete Mcraftr experience.',
    bullets: [
      'Relay unlocks live structured world, entity, terminal, and admin workflows',
      'Beacon unlocks read-only world, structure, plugin, and metadata discovery',
      'Upgrade this server in Connect to explore everything this area can do',
    ],
  },
}

export default function CapabilityLockCard({ requirement, feature, compact = false }: { requirement: Requirement; feature: string; compact?: boolean }) {
  const copy = COPY[requirement]

  return (
    <div className="glass-card border border-[var(--accent-mid)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="text-[11px] font-mono tracking-[0.16em] text-[var(--accent)]">{copy.badge}</div>
          <div className="text-[18px] font-mono text-[var(--text)]">{feature}</div>
          <div className="text-[13px] font-mono text-[var(--text-dim)]">{copy.title}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[var(--accent-mid)] bg-[var(--accent-dim)] text-[var(--accent)]">
          <LockKeyhole size={18} strokeWidth={1.8} />
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
        <div className="flex items-center gap-2 text-[13px] font-mono text-[var(--text)]">
          <RadioTower size={16} strokeWidth={1.8} className="text-[var(--accent)]" />
          {copy.summary}
        </div>
        {!compact && (
          <div className="space-y-2">
            {copy.bullets.map(item => (
              <div key={item} className="flex items-start gap-2 text-[12px] font-mono text-[var(--text-dim)]">
                <Telescope size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/connect?edit=1"
          className="inline-flex rounded-xl border px-3 py-2 text-[11px] font-mono tracking-[0.12em]"
          style={{ borderColor: 'var(--accent-mid)', background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          OPEN CONNECT
        </Link>
        <Link
          href={FULL_STACK_DOCS_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex rounded-xl border px-3 py-2 text-[11px] font-mono tracking-[0.12em] text-[var(--text-dim)]"
          style={{ borderColor: 'var(--border)' }}
        >
          READ FULL STACK DOCS
        </Link>
      </div>
    </div>
  )
}
