import { MARKERS, FRAME_START, FRAME_END, FPS } from '../scene/anatomy'
import { useAppStore, frameToTime } from '../lib/store'

export function Timeline() {
  const frame = useAppStore((s) => s.frame)
  const setFrame = useAppStore((s) => s.setFrame)
  const playing = useAppStore((s) => s.playing)
  const setPlaying = useAppStore((s) => s.setPlaying)
  const jumpToMarker = useAppStore((s) => s.jumpToMarker)
  const spec = useAppStore((s) => s.spec)

  const t = frameToTime(frame)
  const activeCaption =
    spec.captions
      ?.slice()
      .reverse()
      .find((c: { t: number; text: string }) => t >= c.t)?.text ?? spec.caption

  return (
    <footer className="timeline">
      <div className="caption-strip">
        <h2>{spec.title}</h2>
        <p>{activeCaption}</p>
      </div>
      <div className="timeline-controls">
        <button
          type="button"
          className="btn"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={FRAME_START}
          max={FRAME_END}
          value={frame}
          onChange={(e) => {
            setPlaying(false)
            setFrame(Number(e.target.value))
          }}
          aria-label="Animation frame"
        />
        <span className="time">
          {t.toFixed(1)}s · f{frame}
        </span>
      </div>
      <div className="markers">
        {MARKERS.map((m) => (
          <button
            key={m.name + m.frame}
            type="button"
            className={`marker ${Math.abs(frame - m.frame) < 8 ? 'active' : ''}`}
            style={{ left: `${((m.frame - FRAME_START) / (FRAME_END - FRAME_START)) * 100}%` }}
            title={`${m.name} @ ${((m.frame - FRAME_START) / FPS).toFixed(1)}s`}
            onClick={() => jumpToMarker(m.name)}
          >
            <span>{m.name.replace(/ \(.*\)/, '').split(':')[0]}</span>
          </button>
        ))}
      </div>
      <p className="disclaimer">
        Educational visualisation only — not a diagnostic device or clinical advice. Fracture
        geometry is illustrative. Derived from BodyParts3D & Z-Anatomy (CC BY-SA).
      </p>
    </footer>
  )
}
