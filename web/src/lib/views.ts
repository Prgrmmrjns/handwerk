import type { ClinicalView } from '../scene'

/** Camera presets — injury scenes zoom into the carpus / relevant region. */
export const VIEW_PRESETS: Record<
  ClinicalView,
  { position: [number, number, number]; target: [number, number, number]; fov: number }
> = {
  dorsal: { position: [0.01, -0.22, 0.07], target: [0.005, -0.005, 0.03], fov: 32 },
  palmar: { position: [0.01, 0.22, 0.05], target: [0.005, -0.005, 0.03], fov: 32 },
  radial: { position: [0.2, -0.04, 0.05], target: [0.01, -0.005, 0.02], fov: 30 },
  ulnar: { position: [-0.2, -0.02, 0.05], target: [0.0, -0.005, 0.02], fov: 30 },
  // Tight scaphoid / snuffbox framing
  scaphoid: { position: [0.075, -0.055, 0.055], target: [0.02, -0.008, 0.005], fov: 28 },
  oblique: { position: [0.09, -0.08, 0.06], target: [0.015, -0.005, 0.015], fov: 30 },
}

/** Per-scene framing overrides (target the pathology). */
export function framingForSpec(spec: {
  id?: string
  injuries?: { type: string }[]
  camera?: { view?: ClinicalView; position?: [number, number, number]; target?: [number, number, number]; fov?: number }
}): { position: [number, number, number]; target: [number, number, number]; fov: number } {
  const view = spec.camera?.view ?? 'dorsal'
  const base = VIEW_PRESETS[view]
  const inj = spec.injuries?.[0]?.type

  if (inj === 'scaphoid_fracture' || inj === 'scapholunate_injury') {
    return {
      position: spec.camera?.position ?? VIEW_PRESETS.scaphoid.position,
      target: spec.camera?.target ?? VIEW_PRESETS.scaphoid.target,
      fov: spec.camera?.fov ?? VIEW_PRESETS.scaphoid.fov,
    }
  }
  if (inj === 'distal_radius_fracture') {
    return {
      position: spec.camera?.position ?? [0.1, -0.08, 0.02],
      target: spec.camera?.target ?? [0.0, 0.005, -0.02],
      fov: spec.camera?.fov ?? 30,
    }
  }
  if (inj === 'boxers_fracture') {
    return {
      position: spec.camera?.position ?? [-0.05, -0.12, 0.07],
      target: spec.camera?.target ?? [-0.03, -0.015, 0.045],
      fov: spec.camera?.fov ?? 28,
    }
  }

  return {
    position: spec.camera?.position ?? base.position,
    target: spec.camera?.target ?? base.target,
    fov: spec.camera?.fov ?? base.fov,
  }
}
