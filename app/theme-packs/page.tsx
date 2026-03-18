import Link from 'next/link'

export default function ThemePacksDocPage() {
  return (
    <main className="min-h-screen px-4 py-10 sm:px-6" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-3">
          <Link href="/minecraft?tab=settings" className="text-[12px] font-mono tracking-widest" style={{ color: 'var(--accent)' }}>
            Back to Settings
          </Link>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-operator)' }}>Mcraftr Theme Packs</h1>
          <p className="text-sm font-mono" style={{ color: 'var(--text-dim)' }}>
            Theme packs can bundle visual styling, sound effects, and background music into one JSON file.
          </p>
        </div>

        <section className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h2 className="text-[14px] font-mono tracking-widest">What a Theme Pack Can Include</h2>
          <div className="grid gap-2 sm:grid-cols-2 text-[13px] font-mono" style={{ color: 'var(--text-dim)' }}>
            <div>- interface colors</div>
            <div>- accent color</div>
            <div>- optional sound-effect settings</div>
            <div>- optional background-music settings</div>
          </div>
        </section>

        <section className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h2 className="text-[14px] font-mono tracking-widest">Minimal Example</h2>
          <pre className="overflow-x-auto rounded-xl border p-4 text-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--bg2)', color: 'var(--text-dim)' }}><code>{`{
  "name": "Aurora Night",
  "vars": {
    "--bg": "#0a0f18",
    "--bg2": "#111a29",
    "--panel": "#152237",
    "--border": "#2a3b58",
    "--text": "#edf6ff",
    "--text-dim": "#8ea3b5",
    "--red": "#ff5d73"
  },
  "accent": "#59f3d2"
}`}</code></pre>
        </section>

        <section className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h2 className="text-[14px] font-mono tracking-widest">Sound and Music Example</h2>
          <pre className="overflow-x-auto rounded-xl border p-4 text-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--bg2)', color: 'var(--text-dim)' }}><code>{`{
  "name": "Builder Ops",
  "vars": {
    "--bg": "#0b0d11",
    "--bg2": "#151922",
    "--panel": "#1b2230",
    "--border": "#33405a",
    "--text": "#f5f8ff",
    "--text-dim": "#98a7bf",
    "--red": "#ff5a67"
  },
  "accent": "#7df9ff",
  "soundEffects": {
    "masterEnabled": true,
    "volume": 0.55,
    "effects": {
      "uiClick": { "enabled": true, "source": { "type": "builtin", "id": "uiClick" } },
      "success": { "enabled": true, "source": { "type": "builtin", "id": "success" } },
      "notify": { "enabled": true, "source": { "type": "url", "url": "https://example.com/notify.ogg", "label": "Soft Ping" } },
      "error": { "enabled": true, "source": { "type": "builtin", "id": "error" } }
    }
  },
  "backgroundMusic": {
    "enabled": true,
    "volume": 0.25,
    "shuffle": true,
    "tracks": [
      { "type": "builtin", "id": "dryHands" },
      { "type": "builtin", "id": "livingMice" },
      { "type": "url", "url": "https://example.com/custom-theme-loop.ogg", "label": "Theme Loop" }
    ]
  }
}`}</code></pre>
        </section>

        <section className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h2 className="text-[14px] font-mono tracking-widest">Supported Media Sources</h2>
          <div className="space-y-2 text-[13px] font-mono" style={{ color: 'var(--text-dim)' }}>
            <div><strong style={{ color: 'var(--text)' }}>Built-in</strong>: <code>{'{"type":"builtin","id":"uiClick"}'}</code></div>
            <div><strong style={{ color: 'var(--text)' }}>URL</strong>: <code>{'{"type":"url","url":"https://example.com/track.ogg","label":"Custom Track"}'}</code></div>
            <div><strong style={{ color: 'var(--text)' }}>Upload</strong>: <code>{'{"type":"upload","assetId":"asset_xxx","label":"Uploaded Track"}'}</code></div>
          </div>
          <div className="text-[12px] font-mono" style={{ color: 'var(--text-dim)' }}>
            Uploaded asset IDs are local to the browser/app environment that created them. For shareable theme packs, prefer built-in or URL-based sources.
          </div>
        </section>

        <section className="rounded-2xl border p-5 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
          <h2 className="text-[14px] font-mono tracking-widest">Fast Workflow</h2>
          <div className="space-y-2 text-[13px] font-mono" style={{ color: 'var(--text-dim)' }}>
            <div>1. Tune colors, fonts, sound effects, and music in Settings.</div>
            <div>2. Export a theme pack.</div>
            <div>3. Edit the JSON if you want to refine it by hand.</div>
            <div>4. Re-import and iterate.</div>
          </div>
          <div className="text-[12px] font-mono" style={{ color: 'var(--text-dim)' }}>
            Source file for repo docs: `docs/theme-packs.md`
          </div>
        </section>
      </div>
    </main>
  )
}
