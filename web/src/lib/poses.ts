import * as THREE from 'three'
import type { SceneSpec, PosePreset } from '../scene/schema'

export type PoseBook = Record<string, Record<string, [number, number, number]>>

type BonePose = { bone: string; rotationDeg: [number, number, number] }

function findBone(root: THREE.Object3D, name: string): THREE.Bone | null {
  let found: THREE.Bone | null = null
  root.traverse((o) => {
    if (found) return
    if ((o as THREE.Bone).isBone && o.name === name) found = o as THREE.Bone
  })
  return found
}

export function applyEulerPose(
  root: THREE.Object3D,
  rotations: Record<string, [number, number, number]>,
) {
  for (const [name, xyz] of Object.entries(rotations)) {
    const bone = findBone(root, name)
    if (!bone) continue
    bone.rotation.order = 'XYZ'
    bone.rotation.set(xyz[0], xyz[1], xyz[2])
  }
}

export function posePresetToRad(
  poses: PoseBook,
  preset: PosePreset,
): Record<string, [number, number, number]> {
  return poses[preset] ?? poses.rest ?? {}
}

export function boneListToRad(
  list: BonePose[],
): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {}
  for (const p of list) {
    const [x, y, z] = p.rotationDeg
    out[p.bone] = [(x * Math.PI) / 180, (y * Math.PI) / 180, (z * Math.PI) / 180]
  }
  return out
}

function lerpPose(
  a: Record<string, [number, number, number]>,
  b: Record<string, [number, number, number]>,
  t: number,
): Record<string, [number, number, number]> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: Record<string, [number, number, number]> = {}
  for (const k of keys) {
    const av = a[k] ?? [0, 0, 0]
    const bv = b[k] ?? [0, 0, 0]
    out[k] = [
      av[0] + (bv[0] - av[0]) * t,
      av[1] + (bv[1] - av[1]) * t,
      av[2] + (bv[2] - av[2]) * t,
    ]
  }
  return out
}

function resolvePose(
  pose: PosePreset | BonePose[],
  poses: PoseBook,
): Record<string, [number, number, number]> {
  if (typeof pose === 'string') return posePresetToRad(poses, pose)
  return boneListToRad(pose)
}

export function applyPoseFromSpec(
  root: THREE.Object3D,
  spec: SceneSpec,
  poses: PoseBook,
  t = 0,
) {
  if (spec.keyframes && spec.keyframes.length > 0) {
    const kfs = [...spec.keyframes].sort((a, b) => a.t - b.t)
    if (t <= kfs[0]!.t) {
      applyEulerPose(root, resolvePose(kfs[0]!.pose as PosePreset | BonePose[], poses))
      return
    }
    const last = kfs[kfs.length - 1]!
    if (t >= last.t) {
      applyEulerPose(root, resolvePose(last.pose as PosePreset | BonePose[], poses))
      return
    }
    for (let i = 0; i < kfs.length - 1; i++) {
      const a = kfs[i]!
      const b = kfs[i + 1]!
      if (t >= a.t && t <= b.t) {
        const u = (t - a.t) / Math.max(1e-6, b.t - a.t)
        const e =
          a.easing === 'linear' ? u : u * u * (3 - 2 * u)
        applyEulerPose(
          root,
          lerpPose(
            resolvePose(a.pose as PosePreset | BonePose[], poses),
            resolvePose(b.pose as PosePreset | BonePose[], poses),
            e,
          ),
        )
        return
      }
    }
  }

  if (spec.pose) {
    applyEulerPose(root, resolvePose(spec.pose as PosePreset | BonePose[], poses))
  }
}
