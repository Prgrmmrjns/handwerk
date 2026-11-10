import { useState } from 'react'
import { parseRequest, sceneToShareUrl } from '../scene'
import { useAppStore } from '../lib/store'

async function tryLlmParse(text: string): Promise<{
  ok: boolean
  spec?: ReturnType<typeof parseRequest>['spec']
  notes: string[]
}> {
  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: text }),
    })
    if (res.status === 501 || res.status === 404) {
      return { ok: false, notes: ['LLM unavailable — using offline parser'] }
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, notes: [body.error ?? `LLM HTTP ${res.status}`] }
    }
    const body = await res.json()
    return { ok: true, spec: body.spec, notes: body.notes ?? ['Parsed via AI Gateway'] }
  } catch {
    return { ok: false, notes: ['LLM request failed — using offline parser'] }
  }
}

export function RequestBar() {
  const requestText = useAppStore((s) => s.requestText)
  const setRequestText = useAppStore((s) => s.setRequestText)
  const setSpec = useAppStore((s) => s.setSpec)
  const spec = useAppStore((s) => s.spec)
  const parseSource = useAppStore((s) => s.parseSource)
  const parseNotes = useAppStore((s) => s.parseNotes)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function run() {
    setBusy(true)
    const llm = await tryLlmParse(requestText)
    if (llm.ok && llm.spec) {
      setSpec(llm.spec, 'llm', llm.notes)
      setBusy(false)
      return
    }
    const result = parseRequest(requestText)
    setSpec(result.spec ?? parseRequest('anatomy').spec!, 'rules', [
      ...llm.notes,
      ...result.issues.map((i) => i.message),
    ])
    setBusy(false)
  }

  function share() {
    const url = sceneToShareUrl(spec)
    navigator.clipboard?.writeText(url)
    window.history.replaceState({}, '', url.replace(window.location.origin, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <section className="request-bar">
      <label className="request-label" htmlFor="request">
        Animation from a request
      </label>
      <div className="request-row">
        <input
          id="request"
          value={requestText}
          onChange={(e) => setRequestText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder='e.g. “displaced scaphoid waist fracture with Herbert screw”'
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
        {parseNotes[0] ? ` · ${parseNotes[0]}` : ' · offline rules always work; LLM used when AI_GATEWAY / OPENAI key is set'}
      </p>
    </section>
  )
}
