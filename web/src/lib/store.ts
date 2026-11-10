import { create } from 'zustand'
import type { ClinicalView, RenderMode, SceneSpec } from '../scene'
import { SCENES } from '../scene'
import { MARKERS, FPS, FRAME_START, FRAME_END } from '../scene/anatomy'
import { annoScratch } from './annotations'

function defaultDuration(spec: SceneSpec): number {
  if (spec.duration) return spec.duration
  if (spec.injuries?.length) return 12
  if (spec.keyframes?.length) return Math.max(...spec.keyframes.map((k) => k.t), 6)
  return FRAME_END / FPS
}

function shouldAutoPlay(spec: SceneSpec): boolean {
  return Boolean(spec.injuries?.length || spec.clip || spec.keyframes?.length)
}

type AppState = {
  spec: SceneSpec
  renderMode: RenderMode
  view: ClinicalView
  hoveredBone: string | null
  selectedBone: string | null
  playing: boolean
  frame: number
  /** Seconds into the current scene (injury / caption clock). */
  sceneTime: number
  sceneDuration: number
  requestText: string
  parseSource: 'rules' | 'llm' | 'preset' | 'url'
  parseNotes: string[]
  captionIndex: number
  showLabels: boolean
  /** Mobile bottom sheet (scenes / views) open state. */
  sheetOpen: boolean
  cameraEpoch: number
  setSpec: (spec: SceneSpec, source?: AppState['parseSource'], notes?: string[]) => void
  setRenderMode: (m: RenderMode) => void
  setView: (v: ClinicalView) => void
  setHoveredBone: (n: string | null) => void
  setSelectedBone: (n: string | null) => void
  setPlaying: (p: boolean) => void
  setFrame: (f: number) => void
  setSceneTime: (t: number) => void
  setRequestText: (t: string) => void
  jumpToMarker: (name: string) => void
  setShowLabels: (v: boolean) => void
  setSheetOpen: (v: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  spec: SCENES.scaphoid_displaced,
  renderMode: 'solid',
  view: 'scaphoid',
  hoveredBone: null,
  selectedBone: null,
  playing: true,
  frame: FRAME_START,
  sceneTime: 0,
  sceneDuration: defaultDuration(SCENES.scaphoid_displaced),
  requestText: 'show a displaced scaphoid waist fracture healing with a screw',
  parseSource: 'preset',
  parseNotes: [],
  captionIndex: 0,
  showLabels: true,
  sheetOpen: false,
  cameraEpoch: 0,
  setSpec: (spec, source = 'preset', notes = []) => {
    const duration = defaultDuration(spec)
    annoScratch.clear()
    set({
      spec,
      renderMode: spec.mode ?? 'solid',
      view: spec.camera?.view ?? 'dorsal',
      parseSource: source,
      parseNotes: notes,
      captionIndex: 0,
      playing: shouldAutoPlay(spec),
      frame: spec.clip?.frameStart ?? FRAME_START,
      sceneTime: 0,
      sceneDuration: duration,
      cameraEpoch: get().cameraEpoch + 1,
      sheetOpen: false,
    })
  },
  setRenderMode: (renderMode) => set({ renderMode }),
  setView: (view) => set({ view, cameraEpoch: get().cameraEpoch + 1 }),
  setHoveredBone: (hoveredBone) => set({ hoveredBone }),
  setSelectedBone: (selectedBone) => set({ selectedBone }),
  setPlaying: (playing) => set({ playing }),
  setFrame: (frame) =>
    set({ frame: Math.min(FRAME_END, Math.max(FRAME_START, Math.round(frame))) }),
  setSceneTime: (sceneTime) => {
    const dur = get().sceneDuration
    set({ sceneTime: Math.min(dur, Math.max(0, sceneTime)) })
  },
  setRequestText: (requestText) => set({ requestText }),
  jumpToMarker: (name) => {
    const m = MARKERS.find((x) => x.name === name)
    if (m) set({ frame: m.frame, playing: false, sceneTime: (m.frame - FRAME_START) / FPS })
  },
  setShowLabels: (showLabels) => set({ showLabels }),
  setSheetOpen: (sheetOpen) => set({ sheetOpen }),
}))

export function frameToTime(frame: number): number {
  return (frame - FRAME_START) / FPS
}

export function timeToFrame(t: number): number {
  return FRAME_START + Math.round(t * FPS)
}
