import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore, frameToTime } from '../lib/store'
import { BONE_INFO, FPS, FRAME_START } from '../scene/anatomy'
import type { RenderMode } from '../scene'
import { InjuryOverlays } from './InjuryOverlays'
import { applyPoseFromSpec, type PoseBook } from '../lib/poses'

useGLTF.preload('/assets/hand_skeleton.glb')

function setMaterialMode(
  mat: THREE.Material,
  mode: RenderMode,
  highlight: boolean,
  dim: boolean,
) {
  const m = mat as THREE.MeshStandardMaterial
  if (!('isMeshStandardMaterial' in m) || !m.isMeshStandardMaterial) return

  const name = (m.name || '').toLowerCase()
  const isCartilage = name.includes('cartilage')

  if (mode === 'xray') {
    m.transparent = true
    m.opacity = highlight ? 0.85 : 0.22
    m.depthWrite = false
    m.emissive = new THREE.Color(highlight ? '#5aa7d4' : '#1a3040')
    m.emissiveIntensity = highlight ? 0.35 : 0.05
  } else if (mode === 'transparent') {
    m.transparent = true
    m.opacity = highlight ? 0.95 : 0.35
    m.depthWrite = false
    m.emissive = new THREE.Color(highlight ? '#c4a574' : '#000000')
    m.emissiveIntensity = highlight ? 0.2 : 0
  } else {
    m.transparent = dim && !highlight
    m.opacity = dim && !highlight ? 0.28 : 1
    m.depthWrite = !(dim && !highlight)
    m.emissive = new THREE.Color(highlight ? '#b8955a' : '#000000')
    m.emissiveIntensity = highlight ? 0.45 : 0
  }

  if (isCartilage && mode === 'solid' && !highlight) {
    m.color?.set('#73a8c9')
  }
  m.needsUpdate = true
}

export function HandModel({ poses }: { poses: PoseBook }) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF('/assets/hand_skeleton.glb')
  const mixer = useRef<THREE.AnimationMixer | null>(null)
  const action = useRef<THREE.AnimationAction | null>(null)

  const spec = useAppStore((s) => s.spec)
  const renderMode = useAppStore((s) => s.renderMode)
  const hoveredBone = useAppStore((s) => s.hoveredBone)
  const selectedBone = useAppStore((s) => s.selectedBone)
  const playing = useAppStore((s) => s.playing)
  const frame = useAppStore((s) => s.frame)
  const setFrame = useAppStore((s) => s.setFrame)
  const setHoveredBone = useAppStore((s) => s.setHoveredBone)
  const setSelectedBone = useAppStore((s) => s.setSelectedBone)

  const root = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((obj) => {
      // Hide Blender caption / title meshes baked into the GLB (parented to CamOrbit).
      // Leaving them visible causes a diagonal smear of 3D text across the viewport.
      const n = obj.name
      if (n === 'Title' || n === 'Subtitle' || /^Cap_\d+/.test(n)) {
        obj.visible = false
        return
      }
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh
        mesh.castShadow = true
        mesh.receiveShadow = true
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone())
        } else if (mesh.material) {
          mesh.material = mesh.material.clone()
        }
      }
    })
    return clone
  }, [scene])

  // Bind mixer to baked clip when using timeline/clip playback without custom keyframes
  useEffect(() => {
    if (!animations.length) return
    mixer.current = new THREE.AnimationMixer(root)
    const clip = animations[0]!
    action.current = mixer.current.clipAction(clip)
    action.current.play()
    action.current.paused = true
    return () => {
      mixer.current?.stopAllAction()
      mixer.current = null
    }
  }, [animations, root])

  const injuryMode = Boolean(spec.injuries?.length)

  // Scrub / play baked animation (skip when an injury scene owns the clock)
  useEffect(() => {
    if (!action.current || !mixer.current) return
    if (injuryMode || spec.keyframes?.length) {
      action.current.paused = true
      action.current.time = 0
      mixer.current.update(0)
      if (spec.pose) applyPoseFromSpec(root, spec, poses, 0)
      return
    }
    const t = frameToTime(frame)
    action.current.time = t
    mixer.current.update(0)
  }, [frame, spec.keyframes, injuryMode, spec.pose, root, poses, spec])

  useFrame((_, dt) => {
    if (injuryMode) {
      // Keep rest / preset pose; injury overlays animate via sceneTime
      if (spec.pose) applyPoseFromSpec(root, spec, poses, 0)
      return
    }
    const useBaked = !spec.keyframes?.length
    if (useBaked && playing && action.current && mixer.current) {
      action.current.paused = false
      mixer.current.update(dt * (spec.clip?.speed ?? 1))
      const next = FRAME_START + Math.round(action.current.time * FPS)
      if (spec.clip?.frameEnd && next >= spec.clip.frameEnd) {
        action.current.paused = true
        useAppStore.getState().setPlaying(false)
      } else {
        setFrame(next)
      }
    } else if (!useBaked && playing && spec.keyframes) {
      const duration =
        spec.duration ?? Math.max(...spec.keyframes.map((k: { t: number }) => k.t), 1)
      const t = frameToTime(frame) % duration
      applyPoseFromSpec(root, spec, poses, t)
      setFrame(frame + dt * FPS * (spec.clip?.speed ?? 1))
      if (frameToTime(frame) > duration) {
        useAppStore.getState().setPlaying(false)
      }
    } else if (!useBaked) {
      const t = spec.keyframes ? frameToTime(frame) : 0
      applyPoseFromSpec(root, spec, poses, t)
    }
  })

  // Materials / highlights
  useEffect(() => {
    const highlights = new Set<string>(spec.highlights ?? [])
    if (hoveredBone) highlights.add(hoveredBone)
    if (selectedBone) highlights.add(selectedBone)
    const dim = Boolean(spec.dimOthers)

    root.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return
      const mesh = obj as THREE.Mesh
      const hi = highlights.has(mesh.name)
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      for (const mat of mats) {
        if (mat) setMaterialMode(mat, renderMode, hi, dim)
      }
    })
  }, [root, renderMode, hoveredBone, selectedBone, spec.highlights, spec.dimOthers])

  return (
    <group ref={group}>
      <primitive
        object={root}
        onPointerMove={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
          e.stopPropagation()
          let obj: THREE.Object3D | null = e.object
          while (obj && !BONE_INFO[obj.name]) obj = obj.parent
          if (obj && BONE_INFO[obj.name]) setHoveredBone(obj.name)
        }}
        onPointerOut={() => setHoveredBone(null)}
        onClick={(e: { stopPropagation: () => void; object: THREE.Object3D }) => {
          e.stopPropagation()
          let obj: THREE.Object3D | null = e.object
          while (obj && !BONE_INFO[obj.name]) obj = obj.parent
          if (obj && BONE_INFO[obj.name]) setSelectedBone(obj.name)
        }}
      />
      <InjuryOverlays root={root} />
    </group>
  )
}
