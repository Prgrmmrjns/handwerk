import { validateSceneSpec, type ValidationResult } from './validator'
import type { SceneSpec } from './schema'
import { SCENES } from './presets'

function deg(n: number): number {
  return n
}

function extractDegrees(text: string, fallback: number): number {
  const m = text.match(/(\d+(?:\.\d+)?)\s*°/)
  if (m) return Number(m[1])
  const m2 = text.match(/(\d+(?:\.\d+)?)\s*deg(?:rees?)?/)
  if (m2) return Number(m2[1])
  return fallback
}

function weeks(text: string): number {
  const m = text.match(/(\d+)\s*(?:weeks?|wks?)/i)
  return m ? Number(m[1]) : 0
}

/**
 * Deterministic offline request → SceneSpec parser.
 * Handles injury keywords, poses, camera views, and simple sequences.
 * Always returns a validated spec (falls back to anatomy overview).
 */
export function parseRequest(request: string): ValidationResult & { source: 'rules' } {
  const q = request.trim().toLowerCase()
  if (!q) {
    return { ...validateSceneSpec(SCENES.overview), source: 'rules' }
  }

  // Compound motion before single-keyword aliases
  if (/\bfist\b/.test(q) && (/flex/.test(q) || /wrist/.test(q))) {
    const angle = extractDegrees(q, 60)
    const flexRadShare = Math.min(angle, 80) / 80
    const spec: SceneSpec = {
      version: 1,
      id: 'fist_then_flex',
      title: `Fist, then wrist flexion ${deg(angle)}°`,
      caption: `Close to a full fist, then flex the wrist approximately ${angle}° (split across radiocarpal and midcarpal rows).`,
      camera: { view: 'radial' },
      duration: 6,
      keyframes: [
        { t: 0, pose: 'rest' },
        { t: 2, pose: 'fist' },
        {
          t: 5,
          pose: [
            { bone: 'Wrist_Radiocarpal', rotationDeg: [35 * flexRadShare, 0, 0] },
            { bone: 'Wrist_Midcarpal', rotationDeg: [45 * flexRadShare, 0, 0] },
            { bone: 'Index_MCP', rotationDeg: [77.5, 0, 0] },
            { bone: 'Index_PIP', rotationDeg: [85, 0, 0] },
            { bone: 'Index_DIP', rotationDeg: [63, 0, 0] },
            { bone: 'Middle_MCP', rotationDeg: [78.6, 0, 0] },
            { bone: 'Middle_PIP', rotationDeg: [96.1, 0, 0] },
            { bone: 'Middle_DIP', rotationDeg: [59, 0, 0] },
            { bone: 'Ring_MCP', rotationDeg: [75.8, 0, 0] },
            { bone: 'Ring_PIP', rotationDeg: [93.4, 0, 0] },
            { bone: 'Ring_DIP', rotationDeg: [49.5, 0, 0] },
            { bone: 'Little_MCP', rotationDeg: [76.8, 0, 0] },
            { bone: 'Little_PIP', rotationDeg: [95.3, 0, 0] },
            { bone: 'Little_DIP', rotationDeg: [72.8, 0, 0] },
            { bone: 'Thumb_MCP', rotationDeg: [30.7, 0, 0] },
            { bone: 'Thumb_IP', rotationDeg: [74.6, 0, 0] },
          ],
        },
      ],
      disclaimer: true,
    }
    return { ...validateSceneSpec(spec), source: 'rules' }
  }

  // Exact / near-exact preset aliases (scaphoid handled below for richer variants)
  const aliases: Record<string, keyof typeof SCENES> = {
    'distal radius': 'distal_radius',
    colles: 'distal_radius',
    "boxer's fracture": 'boxers',
    boxers: 'boxers',
    'boxer fracture': 'boxers',
    scapholunate: 'scapholunate',
    'sl gap': 'scapholunate',
    spread: 'spread',
    opposition: 'opposition',
    'tendon gliding': 'tendon_gliding',
    'wrist flexion': 'wrist_flex',
    'flex the wrist': 'wrist_flex',
    'wrist extension': 'wrist_ext',
    'make a fist': 'fist',
    fist: 'fist',
  }
  for (const [key, id] of Object.entries(aliases)) {
    if (q === key || q.includes(key)) {
      if (key.includes('wrist') && /scaphoid/.test(q)) continue
      return { ...validateSceneSpec(SCENES[id]), source: 'rules' }
    }
  }

  // --- Scaphoid fracture family ---
  if (/scaphoid/.test(q) || /navicular/.test(q)) {
    const displaced = /displac/.test(q) && !/non[-\s]?displac/.test(q)
    const nondisplaced = /non[-\s]?displac/.test(q) || /undisplac/.test(q)
    const screw = /screw|herbert|fixation|orif/.test(q)
    const cast = /\bcast\b|spica/.test(q)
    const heal = /heal|union|consolidat/.test(q)
    const week = weeks(q) || (heal && screw ? 8 : heal ? 6 : 0)
    const location = /proximal/.test(q)
      ? 'proximal_pole'
      : /distal/.test(q)
        ? 'distal_pole'
        : 'waist'

    const spec: SceneSpec = {
      version: 1,
      id: 'scaphoid_custom',
      title: displaced
        ? 'Displaced scaphoid waist fracture'
        : nondisplaced
          ? 'Non-displaced scaphoid waist fracture'
          : 'Scaphoid fracture',
      caption: buildScaphoidCaption({
        displaced: displaced || (!nondisplaced && /displac/.test(q)),
        screw,
        cast,
        week,
        location,
      }),
      camera: { view: 'scaphoid' },
      mode: 'solid',
      highlights: ['Scaphoid'],
      dimOthers: true,
      pose: 'rest',
      injuries: [
        {
          type: 'scaphoid_fracture',
          location,
          displaced: displaced || (!nondisplaced && displaced !== false && /displac/.test(q)),
          displacementMm: displaced ? 2.5 : 0.4,
          fixation: screw ? 'herbert_screw' : cast ? 'cast' : 'none',
          healingWeek: week,
          showSnuffbox: true,
          showBloodSupply: true,
          showFractureLine: true,
        },
      ],
      captions: scaphoidBeatCaptions({ screw, cast, week, displaced }),
      disclaimer: true,
    }

    // Fix displaced default when user said "displaced"
    if (displaced) {
      spec.injuries![0] = {
        ...spec.injuries![0]!,
        type: 'scaphoid_fracture',
        displaced: true,
        displacementMm: 2.5,
      } as SceneSpec['injuries'] extends (infer I)[] | undefined ? I : never
    }
    if (nondisplaced) {
      ;(spec.injuries![0] as { displaced: boolean; displacementMm: number }).displaced = false
      ;(spec.injuries![0] as { displacementMm: number }).displacementMm = 0.3
    }

    return { ...validateSceneSpec(spec), source: 'rules' }
  }

  if (/radius|colles|smith/.test(q)) {
    return { ...validateSceneSpec(SCENES.distal_radius), source: 'rules' }
  }
  if (/boxer|5th metacarpal|metacarpal.?5|little finger metacarpal/.test(q)) {
    return { ...validateSceneSpec(SCENES.boxers), source: 'rules' }
  }
  if (/scapholunate|sl.?ligament|terry.?thomas|geode/.test(q)) {
    return { ...validateSceneSpec(SCENES.scapholunate), source: 'rules' }
  }

  if (/\bfist\b/.test(q)) return { ...validateSceneSpec(SCENES.fist), source: 'rules' }
  if (/spread|abduct/.test(q)) return { ...validateSceneSpec(SCENES.spread), source: 'rules' }
  if (/opposition|oppose/.test(q)) return { ...validateSceneSpec(SCENES.opposition), source: 'rules' }
  if (/tendon/.test(q)) return { ...validateSceneSpec(SCENES.tendon_gliding), source: 'rules' }
  if (/flex/.test(q) && /wrist/.test(q)) {
    return { ...validateSceneSpec(SCENES.wrist_flex), source: 'rules' }
  }
  if (/extend|extension/.test(q) && /wrist/.test(q)) {
    return { ...validateSceneSpec(SCENES.wrist_ext), source: 'rules' }
  }
  if (/radial.?dev/.test(q)) {
    return {
      ...validateSceneSpec({
        ...SCENES.wrist_flex,
        id: 'rdev',
        title: 'Radial deviation',
        pose: 'rdev',
        clip: { marker: 'Radial deviation 20°' },
        caption: 'Radial deviation ~20° across radiocarpal and midcarpal joints.',
      }),
      source: 'rules',
    }
  }
  if (/ulnar.?dev/.test(q)) {
    return {
      ...validateSceneSpec({
        ...SCENES.wrist_flex,
        id: 'udev',
        title: 'Ulnar deviation',
        pose: 'udev',
        clip: { marker: 'Ulnar deviation 30°' },
        caption: 'Ulnar deviation ~30°.',
      }),
      source: 'rules',
    }
  }

  if (/dorsal|palmar|snuff|anatomy|bones|label/.test(q)) {
    return { ...validateSceneSpec(SCENES.overview), source: 'rules' }
  }

  // Fallback: treat as overview with the request as caption
  return {
    ...validateSceneSpec({
      ...SCENES.overview,
      title: 'Hand anatomy',
      caption: `Could not match a specific injury/pose for “${request.trim()}”. Showing the labeled right-hand skeleton — try “displaced scaphoid waist fracture with Herbert screw” or “make a fist then flex the wrist 60°”.`,
    }),
    source: 'rules',
  }
}

function buildScaphoidCaption(opts: {
  displaced: boolean
  screw: boolean
  cast: boolean
  week: number
  location: string
}): string {
  const bits = [
    `Scaphoid ${opts.location.replace('_', ' ')} fracture`,
    opts.displaced ? 'with displacement' : 'non-displaced / minimally displaced',
  ]
  if (opts.screw) bits.push('Herbert (headless compression) screw fixation')
  else if (opts.cast) bits.push('cast / thumb-spica immobilisation')
  if (opts.week > 0) bits.push(`healing stage ~week ${opts.week}`)
  bits.push(
    'Proximal pole perfusion is largely retrograde — delayed diagnosis risks avascular necrosis and non-union.',
  )
  return bits.join('. ') + '.'
}

function scaphoidBeatCaptions(opts: {
  screw: boolean
  cast: boolean
  week: number
  displaced: boolean
}) {
  const beats = [
    {
      t: 0,
      text: 'Anatomical snuffbox tenderness is the classic clinical clue after a FOOSH.',
    },
    {
      t: 2.5,
      text: opts.displaced
        ? 'Waist fracture with fragment step-off — displacement worsens non-union risk.'
        : 'Fracture line through the scaphoid waist (most common site).',
    },
    {
      t: 5,
      text: 'Blood supply enters mainly distal → proximal; the proximal pole is vulnerable.',
    },
  ]
  if (opts.screw) {
    beats.push({
      t: 7.5,
      text: 'Headless compression (Herbert-type) screw can compress and stabilise the fragments.',
    })
  } else if (opts.cast) {
    beats.push({
      t: 7.5,
      text: 'Stable non-displaced fractures are often treated in a cast; union may take 6–12 weeks.',
    })
  }
  if (opts.week > 0) {
    beats.push({
      t: 10,
      text: `Week ${opts.week}: progressive bony bridging — imaging and exam guide return to load.`,
    })
  }
  return beats
}
