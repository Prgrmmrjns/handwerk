import { useEffect } from 'react'
import { Viewport } from './components/Viewport'
import { ScenePanel } from './components/ScenePanel'
import { RequestBar } from './components/RequestBar'
import { Timeline } from './components/Timeline'
import { readSceneFromLocation } from './scene'
import { useAppStore } from './lib/store'
import { bootCapacitor } from './lib/capacitorBoot'
import './styles/app.css'

export default function App() {
  const setSpec = useAppStore((s) => s.setSpec)

  useEffect(() => {
    const fromUrl = readSceneFromLocation()
    if (fromUrl) setSpec(fromUrl, 'url')
    void bootCapacitor()
  }, [setSpec])

  return (
    <div className="app">
      <ScenePanel />
      <main className="stage">
        <RequestBar />
        <Viewport />
        <Timeline />
      </main>
    </div>
  )
}
