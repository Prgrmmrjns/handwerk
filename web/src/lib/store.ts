import { create } from 'zustand'
import type { ClinicalView, RenderMode, SceneSpec } from '../scene'
import { SCENES } from '../scene'
import { MARKERS, FPS, FRAME_START, FRAME_END } from '../scene/anatomy'

type AppState = {
  spec: SceneSpec
  renderMode: RenderMode
  view: ClinicalView
  hoveredBone: string | null
  selectedBone: string | null
  playing: boolean
  frame: number
  requestText: string
  parseSource: 'rules' | 'llm' | 'preset' | 'url'
  parseNotes: string[]
  captionIndex: number
  showLabels: boolean
  setSpec: (spec: SceneSpec, source?: AppState['parseSource'], notes?: string[]) => void
  setRenderMode: (m: RenderMode) => void
  setView: (v: ClinicalView) => void
  setHoveredBone: (n: string | null) => void
  setSelectedBone: (n: string | null) => void
  setPlaying: (p: boolean) => void
  setFrame: (f: number) => void
  setRequestText: (t: string) => void
  jumpToMarker: (name: string) => void
  setShowLabels: (v: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  spec: SCENES.scaphoid_displaced,
  renderMode: 'solid',
  view: 'scaphoid',
  hoveredBone: null,
  selectedBone: null,
  playing: false,
  frame: FRAME_START,
  requestText: 'show a displaced scaphoid waist fracture healing with a screw',
  parseSource: 'preset',
  parseNotes: [],
  captionIndex: 0,
  showLabels: true,
  setSpec: (spec, source = 'preset', notes = []) =>
    set({
      spec,
      renderMode: spec.mode ?? 'solid',
      view: spec.camera?.view ?? 'dorsal',
      parseSource: source,
      parseNotes: notes,
      captionIndex: 0,
      playing: Boolean(spec.clip || spec.keyframes),
      frame: spec.clip?.frameStart ?? FRAME_START,
    }),
  setRenderMode: (renderMode) => set({ renderMode }),
  setView: (view) => set({ view }),
  setHoveredBone: (hoveredBone) => set({ hoveredBone }),
  setSelectedBone: (selectedBone) => set({ selectedBone }),
  setPlaying: (playing) => set({ playing }),
  setFrame: (frame) =>
    set({ frame: Math.min(FRAME_END, Math.max(FRAME_START, Math.round(frame))) }),
  setRequestText: (requestText) => set({ requestText }),
  jumpToMarker: (name) => {
    const m = MARKERS.find((x) => x.name === name)
    if (m) set({ frame: m.frame, playing: false })
  },
  setShowLabels: (showLabels) => set({ showLabels }),
}))

export function frameToTime(frame: number): number {
  return (frame - FRAME_START) / FPS
}

export function timeToFrame(t: number): number {
  return FRAME_START + Math.round(t * FPS)
}
