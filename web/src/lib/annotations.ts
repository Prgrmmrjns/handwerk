import { create } from 'zustand'

export type ScreenAnno = {
  id: string
  text: string
  x: number
  y: number
  tone: 'info' | 'danger' | 'warn' | 'ok'
  side: 'left' | 'right' | 'top' | 'bottom'
}

/** Scratch pad written by AnnotationLabel during useFrame; flushed once. */
export const annoScratch = new Map<string, Omit<ScreenAnno, 'x' | 'y'> & { world: [number, number, number] }>()

type AnnoState = {
  items: ScreenAnno[]
  setItems: (items: ScreenAnno[]) => void
}

export const useAnnoStore = create<AnnoState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}))
