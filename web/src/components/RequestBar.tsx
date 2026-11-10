import { useState } from 'react'
import { parseRequest, sceneToShareUrl } from '../scene'
import { useAppStore } from '../lib/store'
import { parseApiUrl, shareOrigin, isNativeApp } from '../lib/native'

async function tryLlmParse(text: string): Promise<{
  ok: boolean
  spec?: ReturnType<typeof parseRequest>['spec']
  notes: string[]
}> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, notes: ['Offline — using on-device rule parser'] }
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4500)
  try {
    const res = await fetch(parseApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: text }),
      signal: ctrl.signal,
    })
    if (res.status === 501 || res.status === 404) {
      return { ok: false, notes: ['LLM unavailable — using offline parser'] }
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, notes: [body.error ?? `LLM HTTP ${res.status}`] }
    }
    const body = await res.json()
    return { ok: true, spec: body.spec, notes: body.notes ?? ['Parsed via hosted AI Gateway'] }
  } catch {
    return { ok: false, notes: ['Hosted parse unreachable — using offline parser'] }
  } finally {
    clearTimeout(timer)
  }
}

export function RequestBar() {
  const requestText = useAppStore((s) => s.requestText)
  const setRequestText = useAppStore((s) => s.setRequestText)
  const setSpec = useAppStore((s) => s.setSpec)
  const spec = useAppStore((s) => s.spec)
  const parseSource = useAppStore((s) => s.parseSource)
  const parseNotes = useAppStore((s) => s.parseNotes)
  const sheetOpen = useAppStore((s) => s.sheetOpen)
  const setSheetOpen = useAppStore((s) => s.setSheetOpen)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function run() {
    setBusy(true)
    // On-device offline rules first (always available, including Android)
    const offline = parseRequest(requestText)
    const fallbackSpec = offline.spec ?? parseRequest('anatomy').spec!
    setSpec(fallbackSpec, 'rules', offline.issues.map((i) => i.message))

    // Optionally upgrade via hosted /api/parse when reachable
    const llm = await tryLlmParse(requestText)
    if (llm.ok && llm.spec) {
      setSpec(llm.spec, 'llm', llm.notes)
    } else if (llm.notes.length) {
      setSpec(fallbackSpec, 'rules', [...llm.notes, ...offline.issues.map((i) => i.message)])
    }
    setBusy(false)
  }

  function share() {
    const url = sceneToShareUrl(spec, shareOrigin())
    navigator.clipboard?.writeText(url).catch(() => undefined)
    if (!isNativeApp()) {
      window.history.replaceState({}, '', url.replace(shareOrigin(), '') || '/')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="request-bar">
      <div className="request-top">
        <label className="request-label" htmlFor="request">
          Animation from a request
        </label>
        <button
          type="button"
          className={`btn sheet-toggle ${sheetOpen ? 'active' : ''}`}
          onClick={() => setSheetOpen(!sheetOpen)}
          aria-expanded={sheetOpen}
          aria-controls="scene-sheet"
        >
          Scenes
        </button>
      </div>
      <div className="request-row">
        <input
          id="request"
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder='e.g. “displaced scaphoid waist fracture with Herbert screw”'
          enterKeyHint="go"
        />
        <button type="button" className="btn primary" onClick={run} disabled={busy}>
          {busy ? 'Parsing…' : 'Show'}
        </button>
        <button type="button" className="btn" onClick={share}>
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>
      <p className="request-meta">
        Source: <code>{parseSource}</code>
        {parseNotes[0]
          ? ` · ${parseNotes[0]}`
          : ' · on-device rules always work; hosted LLM used when reachable'}
      </p>
    </section>
  )
}
