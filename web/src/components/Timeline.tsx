import { MARKERS, FRAME_START, FRAME_END, FPS } from '../scene/anatomy'
import { useAppStore, frameToTime } from '../lib/store'

export function Timeline() {
  const frame = useAppStore((s) => s.frame)
  const setFrame = useAppStore((s) => s.setFrame)
  const sceneTime = useAppStore((s) => s.sceneTime)
  const sceneDuration = useAppStore((s) => s.sceneDuration)
  const setSceneTime = useAppStore((s) => s.setSceneTime)
  const playing = useAppStore((s) => s.playing)
  const setPlaying = useAppStore((s) => s.setPlaying)
  const jumpToMarker = useAppStore((s) => s.jumpToMarker)
  const spec = useAppStore((s) => s.spec)
  const injuryMode = Boolean(spec.injuries?.length)

  const t = injuryMode ? sceneTime : frameToTime(frame)
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
          onClick={() => {
            if (!playing && injuryMode && sceneTime >= sceneDuration - 0.05) {
              setSceneTime(0)
            }
            setPlaying(!playing)
          }}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        {injuryMode ? (
          <input
            type="range"
            min={0}
            max={sceneDuration}
            step={0.05}
            value={sceneTime}
            onChange={(e) => {
              setPlaying(false)
              setSceneTime(Number(e.target.value))
            }}
            aria-label="Scene time"
          />
        ) : (
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
        )}
        <span className="time">
          {injuryMode
            ? `${sceneTime.toFixed(1)}s / ${sceneDuration.toFixed(0)}s`
            : `${t.toFixed(1)}s · f${frame}`}
        </span>
      </div>
      {!injuryMode && (
        <div className="markers">
          {MARKERS.map((m) => (
            <button
              key={m.name + m.frame}
              type="button"
              className={`marker ${Math.abs(frame - m.frame) < 8 ? 'active' : ''}`}
              style={{
                left: `${((m.frame - FRAME_START) / (FRAME_END - FRAME_START)) * 100}%`,
              }}
              title={`${m.name} @ ${((m.frame - FRAME_START) / FPS).toFixed(1)}s`}
              onClick={() => jumpToMarker(m.name)}
            >
              <span>{m.name.replace(/ \(.*\)/, '').split(':')[0]}</span>
            </button>
          ))}
        </div>
      )}
      {injuryMode && (
        <div className="phase-ticks" aria-hidden>
          <span style={{ left: '0%' }}>Acute</span>
          <span style={{ left: '30%' }}>Vessels</span>
          <span style={{ left: '55%' }}>Fixation</span>
          <span style={{ left: '85%' }}>Healing</span>
        </div>
      )}
      <p className="disclaimer">
        Educational visualisation only — not a diagnostic device or clinical advice. Fracture
        geometry is illustrative (gaps exaggerated for clarity). Derived from BodyParts3D &amp;
        Z-Anatomy (CC BY-SA).
      </p>
    </footer>
  )
}
