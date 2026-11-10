import { SCENES, type PresetId } from '../scene'
import { useAppStore } from '../lib/store'
import type { ClinicalView, RenderMode } from '../scene'

const INJURY_PRESETS: PresetId[] = [
  'scaphoid_nondisplaced',
  'scaphoid_displaced',
  'scaphoid_screw',
  'scaphoid_cast',
  'distal_radius',
  'boxers',
  'scapholunate',
]

const MOTION_PRESETS: PresetId[] = [
  'overview',
  'fist',
  'spread',
  'opposition',
  'tendon_gliding',
  'wrist_flex',
  'wrist_ext',
]

const VIEWS: ClinicalView[] = ['dorsal', 'palmar', 'radial', 'ulnar', 'scaphoid', 'oblique']
const MODES: RenderMode[] = ['solid', 'xray', 'transparent']

export function ScenePanel() {
  const setSpec = useAppStore((s) => s.setSpec)
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const mode = useAppStore((s) => s.renderMode)
  const setMode = useAppStore((s) => s.setRenderMode)
  const showLabels = useAppStore((s) => s.showLabels)
  const setShowLabels = useAppStore((s) => s.setShowLabels)
  const selected = useAppStore((s) => s.selectedBone)
  const spec = useAppStore((s) => s.spec)

  return (
    <aside className="panel">
      <header className="brand">
        <div className="brand-mark" aria-hidden />
        <div>
          <h1>Handwerk</h1>
          <p>Interactive hand anatomy & injury scenes</p>
        </div>
      </header>

      <div className="panel-block">
        <h2>Injuries</h2>
        <div className="chip-col">
          {INJURY_PRESETS.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip ${spec.id === id ? 'active' : ''}`}
              onClick={() => setSpec(SCENES[id], 'preset')}
            >
              {SCENES[id].title}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-block">
        <h2>Motion library</h2>
        <div className="chip-col">
          {MOTION_PRESETS.map((id) => (
            <button
              key={id}
              type="button"
              className={`chip ${spec.id === id ? 'active' : ''}`}
              onClick={() => setSpec(SCENES[id], 'preset')}
            >
              {SCENES[id].title}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-block">
        <h2>Clinical view</h2>
        <div className="chip-row">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              className={`chip ${view === v ? 'active' : ''}`}
              onClick={() => setView(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-block">
        <h2>Render</h2>
        <div className="chip-row">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`chip ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
          <button
            type="button"
            className={`chip ${showLabels ? 'active' : ''}`}
            onClick={() => setShowLabels(!showLabels)}
          >
            labels
          </button>
        </div>
        {selected && <p className="muted">Selected: {selected}</p>}
      </div>
    </aside>
  )
}
