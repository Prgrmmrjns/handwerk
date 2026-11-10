import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { Html, Line } from '@react-three/drei'
import { useAppStore } from '../lib/store'
import type { ScaphoidFracture } from '../scene'

function worldBox(obj: THREE.Object3D) {
  return new THREE.Box3().setFromObject(obj)
}

function findMesh(root: THREE.Object3D, name: string): THREE.Mesh | null {
  let found: THREE.Mesh | null = null
  root.traverse((o) => {
    if (found) return
    if ((o as THREE.Mesh).isMesh && o.name === name) found = o as THREE.Mesh
  })
  return found
}

/** Procedural waist split of the scaphoid into proximal / distal fragment proxies. */
function ScaphoidFractureViz({
  root,
  injury,
}: {
  root: THREE.Object3D
  injury: ScaphoidFracture
}) {
  const mesh = findMesh(root, 'Scaphoid')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!mesh) return
    // Hide original while fractured visualization is active
    mesh.visible = false
    setReady(true)
    return () => {
      mesh.visible = true
    }
  }, [mesh])

  const parts = useMemo(() => {
    if (!mesh) return null
    const geo = mesh.geometry.clone()
    geo.computeBoundingBox()
    const bb = geo.boundingBox!
    // Waist plane: cut along local long axis midpoint.
    // Scaphoid long axis ≈ X in this asset's rest pose (radial→ulnar / prox→dist roughly along X/Z).
    const cutAxis: 'x' | 'y' | 'z' =
      injury.location === 'proximal_pole'
        ? 'x'
        : injury.location === 'distal_pole'
          ? 'x'
          : 'x'
    const size = new THREE.Vector3()
    bb.getSize(size)
    const mid = (bb.min[cutAxis] + bb.max[cutAxis]) / 2
    const bias =
      injury.location === 'proximal_pole'
        ? -size[cutAxis] * 0.22
        : injury.location === 'distal_pole'
          ? size[cutAxis] * 0.22
          : 0
    const cut = mid + bias

    const pos = geo.attributes.position as THREE.BufferAttribute
    const proxIdx: number[] = []
    const distIdx: number[] = []
    // Split by triangle centroid relative to cut plane
    const index = geo.index
    const pushTri = (i0: number, i1: number, i2: number, bucket: number[]) => {
      bucket.push(i0, i1, i2)
    }
    const triCount = index ? index.count / 3 : pos.count / 3
    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2
      const c =
        (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3 // use X as cut axis default
      const cy =
        cutAxis === 'x'
          ? c
          : cutAxis === 'y'
            ? (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3
            : (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3
      if (cy < cut) pushTri(i0, i1, i2, proxIdx)
      else pushTri(i0, i1, i2, distIdx)
    }

    const makeFrag = (indices: number[]) => {
      const g = geo.clone()
      g.setIndex(indices)
      g.computeVertexNormals()
      return g
    }

    const heal = Math.min(1, injury.healingWeek / 12)
    const gap = injury.displaced
      ? (injury.displacementMm ?? 2.5) * 0.001 * (1 - heal * 0.7)
      : 0.00025 * (1 - heal)

    return {
      prox: makeFrag(proxIdx),
      dist: makeFrag(distIdx),
      matrix: mesh.matrixWorld.clone(),
      cut,
      gap,
      heal,
      parent: mesh.parent,
    }
  }, [mesh, injury])

  if (!mesh || !parts || !ready) return null

  const boneColor = '#e2d3b5'
  const fractureColor = `rgb(${180 + parts.heal * 40}, ${70 + parts.heal * 100}, ${70 + parts.heal * 60})`

  // Snuffbox approx: radial/dorsal to scaphoid
  const box = worldBox(mesh)
  const center = box.getCenter(new THREE.Vector3())
  const snuff = center.clone().add(new THREE.Vector3(0.012, -0.012, 0.008))
  const distalVessel = center.clone().add(new THREE.Vector3(0.01, -0.004, 0.002))
  const proximalPole = center.clone().add(new THREE.Vector3(-0.008, 0.002, -0.002))

  return (
    <group>
      <group matrixAutoUpdate={false} matrix={parts.matrix}>
        <mesh geometry={parts.prox} castShadow>
          <meshStandardMaterial
            color={boneColor}
            roughness={0.48}
            metalness={0.05}
            emissive={fractureColor}
            emissiveIntensity={0.15 + (1 - parts.heal) * 0.25}
          />
        </mesh>
        <mesh
          geometry={parts.dist}
          castShadow
          position={[parts.gap * (injury.displaced ? 1 : 0.2), injury.displaced ? parts.gap * 0.4 : 0, 0]}
        >
          <meshStandardMaterial
            color={boneColor}
            roughness={0.48}
            metalness={0.05}
            emissive={fractureColor}
            emissiveIntensity={0.15 + (1 - parts.heal) * 0.25}
          />
        </mesh>

        {injury.showFractureLine && (
          <mesh rotation={[0, 0, Math.PI / 2]} position={[parts.cut, 0, 0]}>
            <planeGeometry args={[0.018, 0.016]} />
            <meshBasicMaterial
              color={parts.heal > 0.7 ? '#7aab7a' : '#c44b4b'}
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )}

        {injury.fixation === 'herbert_screw' && (
          <mesh rotation={[0, 0, Math.PI / 2]} position={[parts.cut, 0, 0]}>
            <cylinderGeometry args={[0.0009, 0.0011, 0.02, 12]} />
            <meshStandardMaterial color="#c0c6cc" metalness={0.85} roughness={0.25} />
          </mesh>
        )}

        {injury.fixation === 'cast' && (
          <mesh>
            <sphereGeometry args={[0.022, 24, 16]} />
            <meshStandardMaterial
              color="#d8c49a"
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>

      {injury.showSnuffbox && (
        <group position={snuff}>
          <mesh>
            <sphereGeometry args={[0.0032, 16, 12]} />
            <meshBasicMaterial color="#5aa7d4" transparent opacity={0.85} />
          </mesh>
          <Html distanceFactor={0.35} style={{ pointerEvents: 'none' }}>
            <div className="anno">Anatomical snuffbox</div>
          </Html>
        </group>
      )}

      {injury.showBloodSupply && (
        <group>
          <Line
            points={[distalVessel.toArray(), proximalPole.toArray()]}
            color="#c04545"
            lineWidth={2}
            dashed={false}
          />
          <Html position={distalVessel.toArray()} distanceFactor={0.4}>
            <div className="anno anno-danger">Dorsal ridge vessels →</div>
          </Html>
          <Html position={proximalPole.toArray()} distanceFactor={0.4}>
            <div className="anno anno-danger">Proximal pole at risk</div>
          </Html>
        </group>
      )}
    </group>
  )
}

function DistalRadiusViz({ root, mm }: { root: THREE.Object3D; mm: number }) {
  const mesh = findMesh(root, 'Radius')
  useEffect(() => {
    if (!mesh) return
    const base = mesh.position.clone()
    mesh.position.y += mm * 0.001
    mesh.rotation.x += 0.18
    return () => {
      mesh.position.copy(base)
      mesh.rotation.x -= 0.18
    }
  }, [mesh, mm])

  if (!mesh) return null
  const c = worldBox(mesh).getCenter(new THREE.Vector3())
  return (
    <Html position={c.toArray()} distanceFactor={0.45}>
      <div className="anno">Distal radius · Colles pattern</div>
    </Html>
  )
}

function BoxersViz({ root, ang }: { root: THREE.Object3D; ang: number }) {
  const mesh = findMesh(root, 'Metacarpal_5')
  useEffect(() => {
    if (!mesh) return
    mesh.rotation.x += (ang * Math.PI) / 180 * 0.35
    return () => {
      mesh.rotation.x -= (ang * Math.PI) / 180 * 0.35
    }
  }, [mesh, ang])
  if (!mesh) return null
  const c = worldBox(mesh).getCenter(new THREE.Vector3())
  return (
    <Html position={c.toArray()} distanceFactor={0.4}>
      <div className="anno">5th MC neck · {ang}° angulation</div>
    </Html>
  )
}

function ScapholunateViz({ root, gapMm }: { root: THREE.Object3D; gapMm: number }) {
  const scaphoid = findMesh(root, 'Scaphoid')
  const lunate = findMesh(root, 'Lunate')
  useEffect(() => {
    if (!scaphoid || !lunate) return
    const dx = gapMm * 0.001 * 0.5
    scaphoid.position.x += dx
    lunate.position.x -= dx
    return () => {
      scaphoid.position.x -= dx
      lunate.position.x += dx
    }
  }, [scaphoid, lunate, gapMm])

  if (!scaphoid || !lunate) return null
  const a = worldBox(scaphoid).getCenter(new THREE.Vector3())
  const b = worldBox(lunate).getCenter(new THREE.Vector3())
  const mid = a.clone().lerp(b, 0.5)
  return (
    <group>
      <Line points={[a.toArray(), b.toArray()]} color="#e2b84f" lineWidth={2} />
      <Html position={mid.toArray()} distanceFactor={0.4}>
        <div className="anno">SL gap ≈ {gapMm.toFixed(1)} mm</div>
      </Html>
    </group>
  )
}

export function InjuryOverlays({ root }: { root: THREE.Object3D }) {
  const injuries = useAppStore((s) => s.spec.injuries) ?? []
  return (
    <group>
      {injuries.map((inj: (typeof injuries)[number], i: number) => {
        if (inj.type === 'scaphoid_fracture') {
          return <ScaphoidFractureViz key={i} root={root} injury={inj} />
        }
        if (inj.type === 'distal_radius_fracture') {
          return (
            <DistalRadiusViz
              key={i}
              root={root}
              mm={inj.displacementMm ?? (inj.displaced ? 4 : 0)}
            />
          )
        }
        if (inj.type === 'boxers_fracture') {
          return <BoxersViz key={i} root={root} ang={inj.angulationDeg} />
        }
        if (inj.type === 'scapholunate_injury') {
          return <ScapholunateViz key={i} root={root} gapMm={inj.gapMm} />
        }
        return null
      })}
    </group>
  )
}
