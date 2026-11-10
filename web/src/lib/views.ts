import type { ClinicalView } from '../scene'

/** Camera presets for clinical radiographic-ish viewpoints (metres). */
export const VIEW_PRESETS: Record<
  ClinicalView,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  // Dorsal = back of hand facing camera (thumb to viewer's left for right hand)
  dorsal: { position: [0.02, -0.28, 0.08], target: [0.01, 0.0, 0.04] },
  // Palmar = palm facing camera
  palmar: { position: [0.02, 0.28, 0.06], target: [0.01, 0.0, 0.04] },
  // Radial = thumb/radial side
  radial: { position: [0.28, -0.05, 0.06], target: [0.01, 0.0, 0.04] },
  ulnar: { position: [-0.28, -0.02, 0.06], target: [0.01, 0.0, 0.04] },
  // Classic scaphoid view-ish: semi-pronated oblique looking at snuffbox region
  scaphoid: { position: [0.18, -0.16, 0.14], target: [0.02, -0.01, 0.01] },
  oblique: { position: [0.16, -0.2, 0.12], target: [0.01, 0.0, 0.04] },
}
