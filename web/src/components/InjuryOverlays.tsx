import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useAppStore } from '../lib/store'
import type { Injury, ScaphoidFracture } from '../scene'
import { AnnotationLabel } from './AnnotationLabel'

/** Bones in this GLB are Groups with child Mesh parts — not Mesh leaves. */
function findBone(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null
  root.traverse((o) => {
    if (found) return
    if (o.name === name) found = o
  })
  return found
}

function childMeshes(obj: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh)
  })
  return out
}

/** Merge child mesh geometry into the bone group's local space. */
function boneLocalGeometry(bone: THREE.Object3D): THREE.BufferGeometry | null {
  const meshes = childMeshes(bone)
  if (!meshes.length) return null
  bone.updateWorldMatrix(true, true)
  const inv = new THREE.Matrix4().copy(bone.matrixWorld).invert()
  const geos: THREE.BufferGeometry[] = []
  for (const m of meshes) {
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
    const cloned = g.clone()
    m.updateWorldMatrix(true, false)
    cloned.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld))
    geos.push(cloned)
  }
  const merged = mergeGeometries(geos, false)
  if (!merged) return null
  merged.computeVertexNormals()
  merged.computeBoundingBox()
  return merged
}

function setBoneMeshesVisible(bone: THREE.Object3D, visible: boolean) {
  for (const m of childMeshes(bone)) m.visible = visible
}

function worldCenter(obj: THREE.Object3D) {
  return new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3())
}

function longestAxis(bb: THREE.Box3): 'x' | 'y' | 'z' {
  const s = new THREE.Vector3()
  bb.getSize(s)
  if (s.x >= s.y && s.x >= s.z) return 'x'
  if (s.y >= s.z) return 'y'
  return 'z'
}

function splitGeometry(geo: THREE.BufferGeometry, cut: number, axis: 'x' | 'y' | 'z') {
  const g = geo.index ? geo.toNonIndexed() : geo
  const pos = g.attributes.position as THREE.BufferAttribute
  const prox: number[] = []
  const dist: number[] = []
  const triCount = pos.count / 3
  const axisGet = (i: number) =>
    axis === 'x' ? pos.getX(i) : axis === 'y' ? pos.getY(i) : pos.getZ(i)

  for (let t = 0; t < triCount; t++) {
    const i0 = t * 3
    const i1 = i0 + 1
    const i2 = i0 + 2
    const c = (axisGet(i0) + axisGet(i1) + axisGet(i2)) / 3
    const bucket = c < cut ? prox : dist
    bucket.push(i0, i1, i2)
  }

  const make = (indices: number[]) => {
    if (!indices.length) return g.clone()
    const out = g.clone()
    out.setIndex(indices)
    out.computeVertexNormals()
    out.computeBoundingBox()
    return out
  }
  return { prox: make(prox), dist: make(dist) }
}

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x))
}

function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function BloodFlow({
  from,
  to,
  active,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  active: boolean
}) {
  const dots = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!dots.current || !active) return
    const n = dots.current.children.length
    const t = clock.getElapsedTime()
    for (let i = 0; i < n; i++) {
      const child = dots.current.children[i] as THREE.Mesh
      const u = (t * 0.35 + i / n) % 1
      child.position.lerpVectors(from, to, u)
      const s = 0.7 + 0.3 * Math.sin(u * Math.PI)
      child.scale.setScalar(s)
    }
  })
  return (
    <group ref={dots}>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.0016, 10, 8]} />
          <meshBasicMaterial color="#e04040" transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
      <Line points={[from.toArray(), to.toArray()]} color="#c03030" lineWidth={1.5} transparent opacity={0.45} />
    </group>
  )
}

/** Keep overlay group locked to a bone's world pose (under HandModel root). */
function useFollowBone(bone: THREE.Object3D | null, ref: RefObject<THREE.Group | null>) {
  useFrame(() => {
    const g = ref.current
    if (!bone || !g?.parent) return
    bone.updateWorldMatrix(true, false)
    g.parent.updateWorldMatrix(true, false)
    const inv = new THREE.Matrix4().copy(g.parent.matrixWorld).invert()
    g.matrixAutoUpdate = false
    g.matrix.copy(inv).multiply(bone.matrixWorld)
    g.updateMatrixWorld(true)
  })
}

function ScaphoidFractureViz({
  root,
  injury,
  sceneTime,
}: {
  root: THREE.Object3D
  injury: ScaphoidFracture
  sceneTime: number
}) {
  const bone = findBone(root, 'Scaphoid')
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    if (!bone) return
    setBoneMeshesVisible(bone, false)
    return () => setBoneMeshesVisible(bone, true)
  }, [bone])

  const built = useMemo(() => {
    if (!bone) return null
    const geo = boneLocalGeometry(bone)
    if (!geo?.boundingBox) return null
    const bb = geo.boundingBox
    const axis = longestAxis(bb)
    const size = new THREE.Vector3()
    bb.getSize(size)
    const mid = (bb.min[axis] + bb.max[axis]) / 2
    const bias =
      injury.location === 'proximal_pole'
        ? -size[axis] * 0.2
        : injury.location === 'distal_pole'
          ? size[axis] * 0.2
          : 0
    const cut = mid + bias
    const frags = splitGeometry(geo, cut, axis)
    return { ...frags, cut, axis, size }
  }, [bone, injury.location])

  useFollowBone(bone, groupRef)

  // Visible from load — gap already open; screw/cast/heal animate over timeline
  const t = sceneTime
  const reveal = 0.7 + 0.3 * smoothstep(0, 0.6, t)
  const screwPhase =
    injury.fixation === 'herbert_screw' ? 0.12 + 0.88 * smoothstep(1.2, 6.5, t) : 0
  const compress = injury.fixation === 'herbert_screw' ? smoothstep(5.5, 9, t) : 0
  const castPhase = injury.fixation === 'cast' ? 0.35 + 0.65 * smoothstep(1.2, 4, t) : 0
  const healTarget = clamp01(injury.healingWeek / 12)
  const healAnim =
    injury.healingWeek > 0 ? smoothstep(7, 12, t) * healTarget : healTarget * 0.1

  const clinicalGap = injury.displaced ? (injury.displacementMm ?? 2.5) * 0.001 : 0.0012
  const visualBoost = injury.displaced ? 5.5 : 3.2
  const openGap = clinicalGap * visualBoost * reveal * (1 - healAnim * 0.8) * (1 - compress * 0.7)

  if (!bone || !built) return null

  const center = worldCenter(bone)
  const snuff = center.clone().add(new THREE.Vector3(0.014, -0.014, 0.01))
  const distalVessel = center.clone().add(new THREE.Vector3(0.012, -0.006, 0.004))
  const proximalPole = center.clone().add(new THREE.Vector3(-0.01, 0.003, -0.003))

  const gapVec = new THREE.Vector3()
  gapVec[built.axis] = openGap

  const proxColor = new THREE.Color().setHSL(0.03, 0.82 - healAnim * 0.4, 0.48 + healAnim * 0.1)
  const distColor = new THREE.Color('#e8d9b4')
  const callusOpacity = healAnim * 0.55

  const screwInsert = screwPhase
  const screwLen = 0.024
  const screwOffset = (1 - screwInsert) * screwLen * 1.15

  return (
    <group>
      <group ref={groupRef}>
        <mesh geometry={built.prox} castShadow renderOrder={3}>
          <meshStandardMaterial
            color={proxColor}
            roughness={0.38}
            metalness={0.05}
            emissive={proxColor}
            emissiveIntensity={0.65 + (1 - healAnim) * 0.25}
          />
        </mesh>
        <mesh
          geometry={built.dist}
          castShadow
          renderOrder={3}
          position={[gapVec.x, gapVec.y + openGap * 0.4, gapVec.z]}
        >
          <meshStandardMaterial
            color={distColor}
            roughness={0.4}
            metalness={0.05}
            emissive="#c4a050"
            emissiveIntensity={0.4}
          />
        </mesh>

        {injury.showFractureLine && (
          <mesh
            position={
              built.axis === 'x'
                ? [built.cut + openGap * 0.5, 0, 0]
                : built.axis === 'y'
                  ? [0, built.cut + openGap * 0.5, 0]
                  : [0, 0, built.cut + openGap * 0.5]
            }
            rotation={
              built.axis === 'x'
                ? [0, 0, Math.PI / 2]
                : built.axis === 'y'
                  ? [0, 0, 0]
                  : [Math.PI / 2, 0, 0]
            }
          >
            <circleGeometry args={[0.012, 28]} />
            <meshBasicMaterial
              color={healAnim > 0.55 ? '#7aab7a' : '#e04040'}
              transparent
              opacity={0.85}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}

        {healAnim > 0.05 && (
          <mesh
            position={
              built.axis === 'x'
                ? [built.cut, 0, 0]
                : built.axis === 'y'
                  ? [0, built.cut, 0]
                  : [0, 0, built.cut]
            }
            rotation={built.axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}
          >
            <torusGeometry args={[0.009 + healAnim * 0.004, 0.0024, 10, 24]} />
            <meshStandardMaterial
              color="#c4b08a"
              transparent
              opacity={callusOpacity}
              roughness={0.8}
              depthWrite={false}
            />
          </mesh>
        )}

        {injury.fixation === 'herbert_screw' && (
          <group
            position={
              built.axis === 'x'
                ? [built.cut + openGap * 0.3 - screwOffset, 0, 0]
                : built.axis === 'y'
                  ? [0, built.cut - screwOffset, 0]
                  : [0, 0, built.cut - screwOffset]
            }
            rotation={
              built.axis === 'x'
                ? [0, 0, Math.PI / 2]
                : built.axis === 'y'
                  ? [0, 0, 0]
                  : [Math.PI / 2, 0, 0]
            }
          >
            <mesh castShadow>
              <cylinderGeometry args={[0.0016, 0.0019, screwLen, 14]} />
              <meshStandardMaterial color="#c8d4e0" metalness={0.92} roughness={0.18} />
            </mesh>
            <mesh position={[0, screwLen * 0.42, 0]}>
              <cylinderGeometry args={[0.0024, 0.0024, 0.0022, 14]} />
              <meshStandardMaterial color="#9eb0c2" metalness={0.95} roughness={0.15} />
            </mesh>
            <mesh position={[0, -screwLen * 0.42, 0]}>
              <cylinderGeometry args={[0.0021, 0.0013, 0.0026, 14]} />
              <meshStandardMaterial color="#8a9aaa" metalness={0.95} roughness={0.18} />
            </mesh>
          </group>
        )}

        {injury.fixation === 'cast' && (
          <mesh scale={[1.35, 1.55, 1.35]} position={[0.002, 0.004, -0.012]}>
            <sphereGeometry args={[0.032, 28, 18]} />
            <meshStandardMaterial
              color="#cbb892"
              transparent
              opacity={0.28 + castPhase * 0.32}
              depthWrite={false}
              side={THREE.DoubleSide}
              roughness={0.9}
            />
          </mesh>
        )}
      </group>

      {injury.showSnuffbox && (
        <>
          <mesh position={snuff}>
            <sphereGeometry args={[0.004, 16, 12]} />
            <meshBasicMaterial color="#5aa7d4" transparent opacity={0.95} />
          </mesh>
          {injury.fixation !== 'cast' && (
            <AnnotationLabel anchor={snuff} text="Anatomical snuffbox" side="right" tone="info" />
          )}
        </>
      )}

      {injury.showBloodSupply && injury.fixation !== 'cast' && (
        <>
          <BloodFlow from={distalVessel} to={proximalPole} active />
          <AnnotationLabel
            anchor={distalVessel}
            text="Dorsal ridge vessels (enter distal)"
            side="top"
            tone="danger"
          />
          <AnnotationLabel
            anchor={proximalPole}
            text="Proximal pole — AVN risk"
            side="left"
            tone="warn"
          />
        </>
      )}
      {injury.showBloodSupply && injury.fixation === 'cast' && (
        <BloodFlow from={distalVessel} to={proximalPole} active />
      )}

      <AnnotationLabel
        anchor={center.clone().add(new THREE.Vector3(0, 0.014, 0.008))}
        text={
          injury.displaced
            ? `Waist fracture · ${injury.displacementMm ?? 2.5} mm step-off`
            : 'Non-displaced waist fracture'
        }
        side="bottom"
        tone={injury.displaced ? 'danger' : 'warn'}
      />
      {injury.fixation === 'herbert_screw' && (
        <AnnotationLabel
          anchor={center.clone().add(new THREE.Vector3(0.012, -0.018, 0))}
          text={
            compress > 0.5
              ? 'Herbert screw · compressing'
              : screwPhase > 0.5
                ? 'Herbert screw inserting'
                : 'Herbert screw ready'
          }
          side="right"
          tone="ok"
        />
      )}
      {injury.fixation === 'cast' && (
        <AnnotationLabel
          anchor={center.clone().add(new THREE.Vector3(-0.018, 0.022, 0.004))}
          text="Thumb-spica cast"
          side="left"
          tone="info"
        />
      )}
      {healAnim > 0.15 && injury.fixation !== 'cast' && (
        <AnnotationLabel
          anchor={center.clone().add(new THREE.Vector3(0, -0.022, 0.01))}
          text={`Healing · week ${injury.healingWeek} (callus)`}
          side="bottom"
          tone="ok"
        />
      )}
      {healAnim > 0.15 && injury.fixation === 'cast' && (
        <AnnotationLabel
          anchor={center.clone().add(new THREE.Vector3(0.016, -0.02, 0.01))}
          text={`Healing · week ${injury.healingWeek}`}
          side="right"
          tone="ok"
        />
      )}
    </group>
  )
}

function DistalRadiusViz({
  root,
  mm,
  sceneTime,
}: {
  root: THREE.Object3D
  mm: number
  sceneTime: number
}) {
  const bone = findBone(root, 'Radius')
  const fragRef = useRef<THREE.Group>(null)
  const built = useMemo(() => {
    if (!bone) return null
    const geo = boneLocalGeometry(bone)
    if (!geo?.boundingBox) return null
    const bb = geo.boundingBox
    const axis = longestAxis(bb)
    const cut = bb.min[axis] + (bb.max[axis] - bb.min[axis]) * 0.78
    return { ...splitGeometry(geo, cut, axis), cut, axis }
  }, [bone])

  useEffect(() => {
    if (!bone) return
    setBoneMeshesVisible(bone, false)
    return () => setBoneMeshesVisible(bone, true)
  }, [bone])

  useFollowBone(bone, fragRef)

  const open = 0.55 + 0.45 * smoothstep(0.2, 1.8, sceneTime)
  if (!bone || !built) return null
  const gap = mm * 0.001 * 3.5 * open
  const c = worldCenter(bone)
  const gapPos = new THREE.Vector3()
  gapPos[built.axis] = gap

  return (
    <group>
      <group ref={fragRef}>
        <mesh geometry={built.prox} castShadow>
          <meshStandardMaterial color="#e2d3b5" roughness={0.48} />
        </mesh>
        <mesh
          geometry={built.dist}
          castShadow
          position={[gapPos.x, gap * 0.9, gapPos.z]}
          rotation={[0.32 * open, 0, 0]}
        >
          <meshStandardMaterial
            color="#e8a090"
            emissive="#c05040"
            emissiveIntensity={0.45}
            roughness={0.42}
          />
        </mesh>
        <mesh
          position={
            built.axis === 'x'
              ? [built.cut + gap * 0.5, 0, 0]
              : built.axis === 'y'
                ? [0, built.cut + gap * 0.5, 0]
                : [0, 0, built.cut + gap * 0.5]
          }
          rotation={
            built.axis === 'x'
              ? [0, 0, Math.PI / 2]
              : built.axis === 'y'
                ? [0, 0, 0]
                : [Math.PI / 2, 0, 0]
          }
        >
          <circleGeometry args={[0.018, 24]} />
          <meshBasicMaterial color="#d04545" transparent opacity={0.75} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <AnnotationLabel
        anchor={c.clone().add(new THREE.Vector3(0.02, 0.01, 0))}
        text={`Distal radius · Colles · ${mm.toFixed(0)} mm`}
        side="right"
        tone="danger"
      />
    </group>
  )
}

function BoxersViz({
  root,
  ang,
  sceneTime,
}: {
  root: THREE.Object3D
  ang: number
  sceneTime: number
}) {
  const bone = findBone(root, 'Metacarpal_5')
  const followRef = useRef<THREE.Group>(null)
  const open = 0.6 + 0.4 * smoothstep(0.15, 1.4, sceneTime)
  const bend = ((ang * Math.PI) / 180) * 1.1 * open

  const built = useMemo(() => {
    if (!bone) return null
    const geo = boneLocalGeometry(bone)
    if (!geo?.boundingBox) return null
    const bb = geo.boundingBox
    const axis = longestAxis(bb)
    const cut = bb.min[axis] + (bb.max[axis] - bb.min[axis]) * 0.78
    return { ...splitGeometry(geo, cut, axis), cut, axis }
  }, [bone])

  useEffect(() => {
    if (!bone) return
    setBoneMeshesVisible(bone, false)
    return () => setBoneMeshesVisible(bone, true)
  }, [bone])

  useFollowBone(bone, followRef)

  if (!bone || !built) return null
  const c = worldCenter(bone)

  return (
    <group>
      <group ref={followRef}>
        <mesh geometry={built.prox} castShadow renderOrder={3}>
          <meshStandardMaterial color="#e2d3b5" roughness={0.45} emissive="#b8955a" emissiveIntensity={0.2} />
        </mesh>
        <mesh
          geometry={built.dist}
          castShadow
          renderOrder={3}
          position={[0.003 * open, 0.014 * open, 0.006 * open]}
          rotation={[bend, 0.08 * open, 0.2 * open]}
        >
          <meshStandardMaterial
            color="#e87060"
            emissive="#d04030"
            emissiveIntensity={0.65}
            roughness={0.38}
          />
        </mesh>
        <mesh
          position={
            built.axis === 'x'
              ? [built.cut, 0, 0]
              : built.axis === 'y'
                ? [0, built.cut, 0]
                : [0, 0, built.cut]
          }
          rotation={
            built.axis === 'x'
              ? [0, 0, Math.PI / 2]
              : built.axis === 'y'
                ? [0, 0, 0]
                : [Math.PI / 2, 0, 0]
          }
        >
          <circleGeometry args={[0.011, 22]} />
          <meshBasicMaterial color="#e04040" transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
      <AnnotationLabel
        anchor={c.clone().add(new THREE.Vector3(-0.014, -0.01, 0.012))}
        text={`Boxer's · 5th MC neck · ${ang}°`}
        side="left"
        tone="danger"
      />
    </group>
  )
}

function ScapholunateViz({
  root,
  gapMm,
  sceneTime,
}: {
  root: THREE.Object3D
  gapMm: number
  sceneTime: number
}) {
  const scaphoid = findBone(root, 'Scaphoid')
  const lunate = findBone(root, 'Lunate')
  const base = useRef<{ sx: number; lx: number } | null>(null)
  const open = 0.55 + 0.45 * smoothstep(0.2, 1.8, sceneTime)
  const dx = gapMm * 0.001 * 4.2 * open

  useEffect(() => {
    if (!scaphoid || !lunate) return
    if (!base.current) {
      base.current = { sx: scaphoid.position.x, lx: lunate.position.x }
    }
    // Highlight colours
    for (const m of childMeshes(scaphoid)) {
      const mat = m.material as THREE.MeshStandardMaterial
      if (mat?.isMeshStandardMaterial) {
        mat.emissive = new THREE.Color('#c4a040')
        mat.emissiveIntensity = 0.35
      }
    }
    for (const m of childMeshes(lunate)) {
      const mat = m.material as THREE.MeshStandardMaterial
      if (mat?.isMeshStandardMaterial) {
        mat.emissive = new THREE.Color('#c4a040')
        mat.emissiveIntensity = 0.35
      }
    }
    return () => {
      if (base.current) {
        scaphoid.position.x = base.current.sx
        lunate.position.x = base.current.lx
      }
    }
  }, [scaphoid, lunate])

  useFrame(() => {
    if (!scaphoid || !lunate || !base.current) return
    scaphoid.position.x = base.current.sx + dx
    lunate.position.x = base.current.lx - dx * 0.85
  })

  if (!scaphoid || !lunate) return null
  const a = worldCenter(scaphoid)
  const b = worldCenter(lunate)
  const mid = a.clone().lerp(b, 0.5)

  return (
    <group>
      {/* Gap wedge — makes Terry Thomas interval obvious */}
      <mesh position={mid} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0015, 0.0045, Math.max(0.006, dx * 1.6), 10]} />
        <meshBasicMaterial color="#e2b84f" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh position={mid}>
        <sphereGeometry args={[0.0032, 12, 10]} />
        <meshBasicMaterial color="#f0c040" />
      </mesh>
      <AnnotationLabel
        anchor={mid.clone().add(new THREE.Vector3(0, 0.016, 0.008))}
        text={`Scapholunate gap ≈ ${(gapMm * open).toFixed(1)} mm`}
        side="top"
        tone="warn"
      />
      <AnnotationLabel anchor={a} text="Scaphoid" side="right" tone="info" />
      <AnnotationLabel anchor={b} text="Lunate" side="left" tone="info" />
    </group>
  )
}

export function InjuryOverlays({ root }: { root: THREE.Object3D }) {
  const injuries = useAppStore((s) => s.spec.injuries) ?? []
  const sceneTime = useAppStore((s) => s.sceneTime)

  return (
    <group>
      {injuries.map((inj: Injury, i: number) => {
        if (inj.type === 'scaphoid_fracture') {
          return <ScaphoidFractureViz key={i} root={root} injury={inj} sceneTime={sceneTime} />
        }
        if (inj.type === 'distal_radius_fracture') {
          return (
            <DistalRadiusViz
              key={i}
              root={root}
              mm={inj.displacementMm ?? (inj.displaced ? 4 : 0)}
              sceneTime={sceneTime}
            />
          )
        }
        if (inj.type === 'boxers_fracture') {
          return <BoxersViz key={i} root={root} ang={inj.angulationDeg} sceneTime={sceneTime} />
        }
        if (inj.type === 'scapholunate_injury') {
          return <ScapholunateViz key={i} root={root} gapMm={inj.gapMm} sceneTime={sceneTime} />
        }
        return null
      })}
    </group>
  )
}
