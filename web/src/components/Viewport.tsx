import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { HandModel } from './HandModel'
import { useAppStore } from '../lib/store'
import { framingForSpec } from '../lib/views'
import type { PoseBook } from '../lib/poses'
import { BoneLabel } from './BoneLabel'
import { AnnoProjector, ScreenAnnotations } from './ScreenAnnotations'

function CameraRig() {
  const view = useAppStore((s) => s.view)
  const spec = useAppStore((s) => s.spec)
  const epoch = useAppStore((s) => s.cameraEpoch)
  const controls = useRef<OrbitControlsImpl | null>(null)
  const { camera } = useThree()
  const framing = framingForSpec({ ...spec, camera: { ...spec.camera, view } })
  const target = useRef(new THREE.Vector3(...framing.target))
  const goalPos = useRef(new THREE.Vector3(...framing.position))

  useEffect(() => {
    const f = framingForSpec({ ...spec, camera: { ...spec.camera, view } })
    goalPos.current.set(...f.position)
    target.current.set(...f.target)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = f.fov
      camera.updateProjectionMatrix()
    }
  }, [view, spec, epoch, camera])

  useFrame(() => {
    camera.position.lerp(goalPos.current, 0.08)
    if (controls.current) {
      controls.current.target.lerp(target.current, 0.08)
      controls.current.update()
    }
  })

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={framing.position}
        fov={framing.fov}
        near={0.001}
        far={10}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        target={framing.target}
        enablePan
        minDistance={0.04}
        maxDistance={0.7}
        maxPolarAngle={Math.PI * 0.95}
      />
    </>
  )
}

function SceneClock() {
  const playing = useAppStore((s) => s.playing)
  const sceneDuration = useAppStore((s) => s.sceneDuration)
  const setSceneTime = useAppStore((s) => s.setSceneTime)
  const setPlaying = useAppStore((s) => s.setPlaying)
  const hasInjuries = Boolean(useAppStore((s) => s.spec.injuries?.length))

  useFrame((_, dt) => {
    if (!playing || !hasInjuries) return
    const next = useAppStore.getState().sceneTime + dt
    if (next >= sceneDuration) {
      setSceneTime(sceneDuration)
      setPlaying(false)
    } else {
      setSceneTime(next)
    }
  })
  return null
}

export function Viewport() {
  const [poses, setPoses] = useState<PoseBook | null>(null)

  useEffect(() => {
    fetch('/assets/poses.json')
      .then((r) => r.json())
      .then(setPoses)
      .catch(() => setPoses({}))
  }, [])

  return (
    <div className="viewport">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={['#0b1220']} />
        <fog attach="fog" args={['#0b1220', 0.35, 0.95]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[0.4, 0.6, 0.5]} intensity={1.2} castShadow />
        <directionalLight position={[-0.5, 0.2, -0.3]} intensity={0.4} color="#8eb6d8" />
        <Suspense fallback={null}>
          <CameraRig />
          <SceneClock />
          <AnnoProjector />
          {poses && <HandModel poses={poses} />}
          <ContactShadows position={[0, 0.1, 0]} opacity={0.3} scale={0.4} blur={2.2} far={0.35} />
          <Environment preset="city" environmentIntensity={0.3} />
        </Suspense>
      </Canvas>
      <ScreenAnnotations />
      <BoneLabel />
      <div className="viewport-grain" aria-hidden />
    </div>
  )
}
