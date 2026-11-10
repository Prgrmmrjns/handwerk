import { useEffect, useId, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { annoScratch, type ScreenAnno } from '../lib/annotations'

export type AnnoSide = ScreenAnno['side']

/** Registers a world anchor; ScreenAnnotations flushes projections each frame. */
export function AnnotationLabel({
  anchor,
  text,
  side = 'right',
  tone = 'info',
}: {
  anchor: THREE.Vector3 | [number, number, number]
  text: string
  side?: AnnoSide
  tone?: ScreenAnno['tone']
  leader?: boolean
}) {
  const id = useId()
  const world = Array.isArray(anchor)
    ? ([anchor[0], anchor[1], anchor[2]] as [number, number, number])
    : ([anchor.x, anchor.y, anchor.z] as [number, number, number])

  useLayoutEffect(() => {
    annoScratch.set(id, { id, text, tone, side, world })
  }, [id, text, tone, side, world[0], world[1], world[2]])

  useEffect(() => {
    return () => {
      annoScratch.delete(id)
    }
  }, [id])

  return null
}
