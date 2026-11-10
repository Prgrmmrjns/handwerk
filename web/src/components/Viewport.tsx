import { Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import { HandModel } from './HandModel'
import { useAppStore } from '../lib/store'
import { VIEW_PRESETS } from '../lib/views'
import type { PoseBook } from '../lib/poses'
import { BoneLabel } from './BoneLabel'

function CameraRig() {
  const view = useAppStore((s) => s.view)
  const spec = useAppStore((s) => s.spec)
  const preset = VIEW_PRESETS[view]
  const position = spec.camera?.position ?? preset.position
  const target = spec.camera?.target ?? preset.target

  return (
    <>
      <PerspectiveCamera makeDefault position={position} fov={spec.camera?.fov ?? 35} near={0.001} far={10} />
      <OrbitControls
        makeDefault
        target={target}
        enablePan
        minDistance={0.08}
        maxDistance={0.9}
        maxPolarAngle={Math.PI * 0.95}
      />
    </>
  )
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
        <fog attach="fog" args={['#0b1220', 0.55, 1.4]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[0.4, 0.6, 0.5]} intensity={1.15} castShadow />
        <directionalLight position={[-0.5, 0.2, -0.3]} intensity={0.35} color="#8eb6d8" />
        <Suspense fallback={null}>
          <CameraRig />
          {poses && <HandModel poses={poses} />}
          <ContactShadows
            position={[0, 0.12, 0]}
            opacity={0.35}
            scale={0.5}
            blur={2.5}
            far={0.4}
          />
          <Environment preset="city" environmentIntensity={0.35} />
        </Suspense>
      </Canvas>
      <BoneLabel />
      <div className="viewport-grain" aria-hidden />
    </div>
  )
}
