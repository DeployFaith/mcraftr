'use client'

import { useCallback, useEffect, useState } from 'react'
import CollapsibleCard from './CollapsibleCard'
import { useToast } from './useToast'
import Toasts from './Toasts'

type Schedule = {
  id: string
  label: string
  enabled: boolean
  cadence: 'daily' | 'weekly' | 'monthly'
  timezone: string
  timeOfDay: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  actionType: 'broadcast' | 'save_all' | 'time' | 'weather' | 'difficulty' | 'gamerule'
  actionPayload: Record<string, string>
  lastRunAt: number | null
  nextRunAt: number
}

type ScheduleRun = {
  id: number
  taskId: string
  status: 'ok' | 'error'
  output: string | null
  startedAt: number
}

type ScheduleFormState = {
  label: string
  enabled: boolean
  cadence: Schedule['cadence']
  timezone: string
  timeOfDay: string
  dayOfWeek: number
  dayOfMonth: number
  actionType: Schedule['actionType']
  message: string
  value: string
  difficulty: string
  gamerule: string
  gameruleValue: string
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function defaultForm(): ScheduleFormState {
  return {
    label: '',
    enabled: true,
    cadence: 'daily',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    timeOfDay: '19:00',
    dayOfWeek: 0,
    dayOfMonth: 1,
    actionType: 'broadcast',
    message: '',
    value: 'day',
    difficulty: 'normal',
    gamerule: 'mobGriefing',
    gameruleValue: 'false',
  }
}

export default function ScheduleSection({ groupKey }: { groupKey?: string }) {
  const { toasts, addToast } = useToast()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [runs, setRuns] = useState<ScheduleRun[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ScheduleFormState>(defaultForm())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/minecraft/schedules')
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to load schedules')
      setSchedules(data.schedules ?? [])
      setRuns(data.runs ?? [])
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to load schedules')
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setEditingId(null)
    setForm(defaultForm())
  }

  const payloadForSubmit = () => {
    if (form.actionType === 'broadcast') return { message: form.message }
    if (form.actionType === 'save_all') return {}
    if (form.actionType === 'time') return { value: form.value === 'night' ? 'night' : 'day' }
    if (form.actionType === 'weather') return { value: form.value === 'storm' ? 'storm' : 'clear' }
    if (form.actionType === 'difficulty') return { value: form.difficulty }
    return { rule: form.gamerule, value: form.gameruleValue }
  }

  const saveSchedule = async () => {
    setSaving(true)
    try {
      const res = await fetch(editingId ? `/api/minecraft/schedules/${editingId}` : '/api/minecraft/schedules', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: form.label,
          enabled: form.enabled,
          cadence: form.cadence,
          timezone: form.timezone,
          timeOfDay: form.timeOfDay,
          dayOfWeek: form.cadence === 'weekly' ? Number(form.dayOfWeek) : null,
          dayOfMonth: form.cadence === 'monthly' ? Number(form.dayOfMonth) : null,
          actionType: form.actionType,
          actionPayload: payloadForSubmit(),
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to save schedule')
      addToast('ok', editingId ? 'Schedule updated' : 'Schedule created')
      resetForm()
      await load()
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to save schedule')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (schedule: Schedule) => {
    setEditingId(schedule.id)
    setForm({
      label: schedule.label,
      enabled: schedule.enabled,
      cadence: schedule.cadence,
      timezone: schedule.timezone,
      timeOfDay: schedule.timeOfDay,
      dayOfWeek: schedule.dayOfWeek ?? 0,
      dayOfMonth: schedule.dayOfMonth ?? 1,
      actionType: schedule.actionType,
      message: schedule.actionPayload.message ?? '',
      value: schedule.actionPayload.value ?? 'day',
      difficulty: schedule.actionPayload.value ?? 'normal',
      gamerule: schedule.actionPayload.rule ?? 'mobGriefing',
      gameruleValue: schedule.actionPayload.value ?? 'false',
    })
  }

  const deleteEntry = async (schedule: Schedule) => {
    if (!confirm(`Delete schedule "${schedule.label}"?`)) return
    try {
      const res = await fetch(`/api/minecraft/schedules/${schedule.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to delete schedule')
      addToast('ok', 'Schedule deleted')
      if (editingId === schedule.id) resetForm()
      await load()
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to delete schedule')
    }
  }

  const toggleEnabled = async (schedule: Schedule) => {
    try {
      const res = await fetch(`/api/minecraft/schedules/${schedule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...schedule,
          enabled: !schedule.enabled,
          actionPayload: schedule.actionPayload,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Failed to update schedule')
      addToast('ok', !schedule.enabled ? 'Schedule enabled' : 'Schedule disabled')
      await load()
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to update schedule')
    }
  }

  return (
    <CollapsibleCard title="SCHEDULES" storageKey="admin:schedules" groupKey={groupKey} bodyClassName="p-4 space-y-4">
      <Toasts toasts={toasts} />

      <div className="text-[12px] font-mono text-[var(--text-dim)]">
        Run safe recurring actions on the active server. Missed runs after downtime are skipped and rescheduled forward.
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
        <div className="text-[13px] font-mono text-[var(--accent)] tracking-widest">
          {editingId ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}
        </div>

        <input
          value={form.label}
          onChange={e => setForm(prev => ({ ...prev, label: e.target.value }))}
          placeholder="Evening save, Night reset, Reminder..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[15px] font-mono text-[var(--text)] focus:outline-none focus:border-[var(--accent-mid)]"
        />

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <select value={form.cadence} onChange={e => setForm(prev => ({ ...prev, cadence: e.target.value as Schedule['cadence'] }))} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input value={form.timeOfDay} onChange={e => setForm(prev => ({ ...prev, timeOfDay: e.target.value }))} type="time" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]" />
          {form.cadence === 'weekly' && (
            <select value={form.dayOfWeek} onChange={e => setForm(prev => ({ ...prev, dayOfWeek: Number(e.target.value) }))} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
              {WEEKDAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
          )}
          {form.cadence === 'monthly' && (
            <input value={form.dayOfMonth} onChange={e => setForm(prev => ({ ...prev, dayOfMonth: Number(e.target.value) || 1 }))} min={1} max={31} type="number" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]" />
          )}
          <input value={form.timezone} onChange={e => setForm(prev => ({ ...prev, timezone: e.target.value }))} placeholder="America/Chicago" className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]" />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <select value={form.actionType} onChange={e => setForm(prev => ({ ...prev, actionType: e.target.value as Schedule['actionType'] }))} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
            <option value="broadcast">Broadcast</option>
            <option value="save_all">Save All</option>
            <option value="time">Time</option>
            <option value="weather">Weather</option>
            <option value="difficulty">Difficulty</option>
            <option value="gamerule">Gamerule</option>
          </select>

          {form.actionType === 'broadcast' && (
            <input value={form.message} onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))} placeholder="Server restart in 10 minutes" className="sm:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]" />
          )}

          {form.actionType === 'time' && (
            <select value={form.value} onChange={e => setForm(prev => ({ ...prev, value: e.target.value }))} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
              <option value="day">Day</option>
              <option value="night">Night</option>
            </select>
          )}

          {form.actionType === 'weather' && (
            <select value={form.value} onChange={e => setForm(prev => ({ ...prev, value: e.target.value }))} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
              <option value="clear">Clear</option>
              <option value="storm">Storm</option>
            </select>
          )}

          {form.actionType === 'difficulty' && (
            <select value={form.difficulty} onChange={e => setForm(prev => ({ ...prev, difficulty: e.target.value }))} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
              <option value="peaceful">Peaceful</option>
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          )}

          {form.actionType === 'gamerule' && (
            <>
              <select value={form.gamerule} onChange={e => setForm(prev => ({ ...prev, gamerule: e.target.value }))} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
                <option value="mobGriefing">Mob Griefing</option>
                <option value="keepInventory">Keep Inventory</option>
                <option value="pvp">PvP</option>
                <option value="doDaylightCycle">Daylight Cycle</option>
                <option value="doWeatherCycle">Weather Cycle</option>
                <option value="doFireTick">Fire Tick</option>
                <option value="doMobSpawning">Mob Spawning</option>
                <option value="naturalRegeneration">Natural Regeneration</option>
              </select>
              <select value={form.gameruleValue} onChange={e => setForm(prev => ({ ...prev, gameruleValue: e.target.value }))} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[13px] font-mono text-[var(--text)]">
                <option value="true">ON</option>
                <option value="false">OFF</option>
              </select>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input id="schedule-enabled" type="checkbox" checked={form.enabled} onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))} className="accent-[var(--accent)]" />
          <label htmlFor="schedule-enabled" className="text-[12px] font-mono text-[var(--text-dim)]">Enabled</label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => void saveSchedule()} disabled={saving} className="rounded-lg border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-4 py-2 text-[13px] font-mono text-[var(--accent)] disabled:opacity-40">
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Schedule'}
          </button>
          {(editingId || form.label || form.message) && (
            <button onClick={resetForm} className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-mono text-[var(--text-dim)]">
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">ACTIVE SCHEDULES</div>
          {loading ? (
            <div className="glass-card p-4 text-[13px] font-mono text-[var(--text-dim)]">Loading schedules…</div>
          ) : schedules.length === 0 ? (
            <div className="glass-card p-4 text-[13px] font-mono text-[var(--text-dim)]">No schedules yet.</div>
          ) : (
            schedules.map(schedule => (
              <div key={schedule.id} className="glass-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-mono text-[var(--text)]">{schedule.label}</div>
                    <div className="text-[11px] font-mono text-[var(--text-dim)] mt-1">
                      {schedule.cadence} · {schedule.timeOfDay} · {schedule.timezone}
                    </div>
                  </div>
                  <button onClick={() => void toggleEnabled(schedule)} className={`rounded border px-2 py-1 text-[11px] font-mono ${schedule.enabled ? 'border-[var(--accent-mid)] bg-[var(--accent-dim)] text-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-dim)]'}`}>
                    {schedule.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="text-[11px] font-mono text-[var(--text-dim)]">
                  Next {new Date(schedule.nextRunAt).toLocaleString()}
                  {schedule.lastRunAt ? ` · Last ${new Date(schedule.lastRunAt).toLocaleString()}` : ''}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => startEdit(schedule)} className="rounded border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text-dim)]">Edit</button>
                  <button onClick={() => void deleteEntry(schedule)} className="rounded border border-red-900 px-3 py-2 text-[12px] font-mono text-red-400">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-3">
          <div className="text-[13px] font-mono tracking-widest text-[var(--text-dim)]">RECENT RUNS</div>
          {runs.length === 0 ? (
            <div className="glass-card p-4 text-[13px] font-mono text-[var(--text-dim)]">No scheduled runs yet.</div>
          ) : (
            runs.map(run => (
              <div key={run.id} className="glass-card p-4 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12px] font-mono text-[var(--text-dim)]">{new Date(run.startedAt).toLocaleString()}</div>
                  <div className={`text-[11px] font-mono ${run.status === 'ok' ? 'text-[var(--accent)]' : 'text-red-400'}`}>{run.status.toUpperCase()}</div>
                </div>
                <div className="text-[12px] font-mono text-[var(--text)] break-words">{run.output || 'No output'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </CollapsibleCard>
  )
}
