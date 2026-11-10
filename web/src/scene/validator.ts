import {
  JOINT_LIMITS_RAD,
  SceneSpecSchema,
  type BoneName,
  type SceneSpec,
} from './schema'

export type ValidationIssue = {
  path: string
  message: string
  severity: 'error' | 'warning'
}

export type ValidationResult = {
  ok: boolean
  spec?: SceneSpec
  issues: ValidationIssue[]
}

const DEG = 180 / Math.PI

function clampBoneRotation(
  bone: BoneName,
  rotationDeg: [number, number, number],
  issues: ValidationIssue[],
  path: string,
): [number, number, number] {
  const lim = JOINT_LIMITS_RAD[bone]
  if (!lim) return rotationDeg

  const out: [number, number, number] = [...rotationDeg]
  for (let i = 0; i < 3; i++) {
    const minDeg = lim.min[i]! * DEG
    const maxDeg = lim.max[i]! * DEG
    if (out[i]! < minDeg - 0.5 || out[i]! > maxDeg + 0.5) {
      issues.push({
        path: `${path}[${i}]`,
        message: `${bone} axis ${'xyz'[i]} ${out[i]!.toFixed(1)}° outside [${minDeg.toFixed(1)}, ${maxDeg.toFixed(1)}]° — clamped`,
        severity: 'warning',
      })
      out[i] = Math.min(maxDeg, Math.max(minDeg, out[i]!))
    }
  }
  return out
}

function clampPoseArray(
  poses: SceneSpec['pose'],
  issues: ValidationIssue[],
  path: string,
): SceneSpec['pose'] {
  if (!poses || typeof poses === 'string') return poses
  return poses.map(
    (
      p: { bone: BoneName; rotationDeg: [number, number, number] },
      idx: number,
    ) => ({
      ...p,
      rotationDeg: clampBoneRotation(p.bone, p.rotationDeg, issues, `${path}.${idx}.rotationDeg`),
    }),
  )
}

/**
 * Parse + validate a scene-spec object. Clamps bone angles to joint limits
 * (warnings) and rejects structurally invalid specs (errors).
 */
export function validateSceneSpec(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = []
  const parsed = SceneSpecSchema.safeParse(input)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
        severity: 'error',
      })
    }
    return { ok: false, issues }
  }

  const spec: SceneSpec = { ...parsed.data }
  spec.pose = clampPoseArray(spec.pose, issues, 'pose')
  if (spec.keyframes) {
    spec.keyframes = spec.keyframes.map((kf, i: number) => ({
      ...kf,
      pose:
        typeof kf.pose === 'string'
          ? kf.pose
          : clampPoseArray(kf.pose, issues, `keyframes.${i}.pose`)!,
    }))
  }

  if (spec.injuries) {
    for (const [i, inj] of spec.injuries.entries()) {
      if (inj.type === 'scaphoid_fracture' && inj.displaced && (inj.displacementMm ?? 0) === 0) {
        inj.displacementMm = 2.5
        issues.push({
          path: `injuries.${i}.displacementMm`,
          message: 'Displaced scaphoid fracture defaulted to 2.5 mm step-off',
          severity: 'warning',
        })
      }
    }
  }

  if (spec.disclaimer !== false) spec.disclaimer = true

  const hasErrors = issues.some((x) => x.severity === 'error')
  return { ok: !hasErrors, spec: hasErrors ? undefined : spec, issues }
}
