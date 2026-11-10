import { create } from 'zustand'

export type ScreenAnno = {
  id: string
  text: string
  x: number
  y: number
  /** Final card top-left after edge clamping / side flip. */
  cardX: number
  cardY: number
  /** Leader stub endpoint (toward the card). */
  leaderX: number
  leaderY: number
  tone: 'info' | 'danger' | 'warn' | 'ok'
  side: 'left' | 'right' | 'top' | 'bottom'
}

/** Scratch pad written by AnnotationLabel; flushed once per frame. */
export const annoScratch = new Map<
  string,
  Omit<ScreenAnno, 'x' | 'y' | 'cardX' | 'cardY' | 'leaderX' | 'leaderY'> & {
    world: [number, number, number]
  }
>()

type AnnoState = {
  items: ScreenAnno[]
  setItems: (items: ScreenAnno[]) => void
}

export const useAnnoStore = create<AnnoState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
}))
