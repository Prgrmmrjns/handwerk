import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { annoScratch, useAnnoStore, type ScreenAnno } from '../lib/annotations'
import { useAppStore } from '../lib/store'

type Side = ScreenAnno['side']

const OFFSET: Record<Side, { lx: number; ly: number; tx: number; ty: number }> = {
  left: { lx: -28, ly: 0, tx: -158, ty: -14 },
  right: { lx: 28, ly: 0, tx: 16, ty: -14 },
  top: { lx: 0, ly: -28, tx: -70, ty: -48 },
  bottom: { lx: 0, ly: 28, tx: -70, ty: 16 },
}

const CARD_H = 44
const CARD_W = 168
const MARGIN = 10
/** Keep cards clear of the soft bottom HUD / overflow edge on phones. */
const BOTTOM_PAD = 18

function layoutCard(
  anchorX: number,
  anchorY: number,
  preferred: Side,
  width: number,
  height: number,
): { side: Side; cardX: number; cardY: number; leaderX: number; leaderY: number } {
  let side = preferred
  const maxY = height - CARD_H - MARGIN - BOTTOM_PAD
  const trySides: Side[] =
    preferred === 'left'
      ? ['left', 'right', 'top', 'bottom']
      : preferred === 'right'
        ? ['right', 'left', 'top', 'bottom']
        : preferred === 'top'
          ? ['top', 'bottom', 'right', 'left']
          : ['bottom', 'top', 'right', 'left']

  // Near the left edge, prefer flipping right before clamping into the anchor.
  if (preferred === 'left' && anchorX < CARD_W + MARGIN * 2) {
    trySides.splice(0, trySides.length, 'right', 'top', 'bottom', 'left')
  }
  if (preferred === 'right' && anchorX > width - CARD_W - MARGIN * 2) {
    trySides.splice(0, trySides.length, 'left', 'top', 'bottom', 'right')
  }

  for (const s of trySides) {
    const o = OFFSET[s]
    let cardX = anchorX + o.tx
    let cardY = anchorY + o.ty
    cardX = Math.min(width - CARD_W - MARGIN, Math.max(MARGIN, cardX))
    cardY = Math.min(maxY, Math.max(MARGIN, cardY))
    const leaderX = anchorX + o.lx
    const leaderY = anchorY + o.ly
    const fitsHoriz =
      (s === 'left' && cardX + CARD_W <= anchorX - 4) ||
      (s === 'right' && cardX >= anchorX + 4) ||
      s === 'top' ||
      s === 'bottom'
    const fitsVert =
      (s === 'top' && cardY + CARD_H <= anchorY - 2) ||
      (s === 'bottom' && cardY >= anchorY + 2) ||
      s === 'left' ||
      s === 'right'
    if ((fitsHoriz && fitsVert) || s === trySides[trySides.length - 1]) {
      return {
        side: s,
        cardX,
        cardY,
        leaderX: Math.min(width - MARGIN, Math.max(MARGIN, leaderX)),
        leaderY: Math.min(height - MARGIN, Math.max(MARGIN, leaderY)),
      }
    }
    side = s
  }
  const o = OFFSET[side]
  return {
    side,
    cardX: Math.min(width - CARD_W - MARGIN, Math.max(MARGIN, anchorX + o.tx)),
    cardY: Math.min(maxY, Math.max(MARGIN, anchorY + o.ty)),
    leaderX: Math.min(width - MARGIN, Math.max(MARGIN, anchorX + o.lx)),
    leaderY: Math.min(height - MARGIN, Math.max(MARGIN, anchorY + o.ly)),
  }
}

/** Projects scratch anchors → store once per frame (lives inside Canvas). */
export function AnnoProjector() {
  const { camera, size } = useThree()
  const setItems = useAnnoStore((s) => s.setItems)
  const show = useAppStore((s) => s.showLabels)
  const v = new THREE.Vector3()

  useFrame(() => {
    if (!show) {
      setItems([])
      return
    }
    const raw: { id: string; text: string; tone: ScreenAnno['tone']; side: Side; x: number; y: number }[] =
      []
    for (const a of annoScratch.values()) {
      v.set(a.world[0], a.world[1], a.world[2]).project(camera)
      if (v.z > 1) continue
      let x = (v.x * 0.5 + 0.5) * size.width
      let y = (-v.y * 0.5 + 0.5) * size.height
      x = Math.min(size.width - MARGIN, Math.max(MARGIN, x))
      y = Math.min(size.height - MARGIN, Math.max(MARGIN, y))
      raw.push({ id: a.id, text: a.text, tone: a.tone, side: a.side, x, y })
    }

    raw.sort((a, b) => a.y - b.y || a.x - b.x)
    for (let i = 1; i < raw.length; i++) {
      const prev = raw[i - 1]!
      const cur = raw[i]!
      if (Math.abs(cur.x - prev.x) < 150 && cur.y - prev.y < CARD_H) {
        cur.y = prev.y + CARD_H
      }
    }

    const next: ScreenAnno[] = raw.map((a) => {
      const laid = layoutCard(a.x, a.y, a.side, size.width, size.height)
      return {
        id: a.id,
        text: a.text,
        tone: a.tone,
        side: laid.side,
        x: a.x,
        y: a.y,
        cardX: laid.cardX,
        cardY: laid.cardY,
        leaderX: laid.leaderX,
        leaderY: laid.leaderY,
      }
    })

    // Second pass: place into free L/R column slots without overlapping painted cards.
    const maxY = size.height - CARD_H - MARGIN - BOTTOM_PAD
    const leftCol = MARGIN
    const rightCol = Math.max(leftCol, size.width - CARD_W - MARGIN)
    const mid = size.width * 0.5
    const placed: { x: number; y: number }[] = []
    const slotTaken = (x: number, y: number) =>
      placed.some((p) => Math.abs(p.x - x) < CARD_W - 8 && Math.abs(p.y - y) < CARD_H - 2)

    next.sort((a, b) => a.cardY - b.cardY || a.cardX - b.cardX)
    for (const cur of next) {
      const preferredX = cur.cardX < mid ? leftCol : rightCol
      const otherX = preferredX === leftCol ? rightCol : leftCol
      let y = Math.min(maxY, Math.max(MARGIN, cur.cardY))
      let x = preferredX
      let found = false
      for (const col of [preferredX, otherX]) {
        let ty = y
        for (let step = 0; step < next.length + 2; step++) {
          if (!slotTaken(col, ty)) {
            x = col
            y = ty
            found = true
            break
          }
          ty = Math.min(maxY, ty + CARD_H)
        }
        if (found) break
        // Try walking upward from preferred y in this column
        ty = y
        for (let step = 0; step < next.length + 2; step++) {
          if (!slotTaken(col, ty)) {
            x = col
            y = ty
            found = true
            break
          }
          ty = Math.max(MARGIN, ty - CARD_H)
        }
        if (found) break
      }
      if (!found) {
        // Absolute fallback: unique row index in the wider column
        x = rightCol
        y = Math.min(maxY, MARGIN + placed.length * CARD_H)
      }
      cur.cardX = x
      cur.cardY = y
      placed.push({ x, y })
    }

    setItems(next)
  })

  return null
}

/** DOM overlay outside/over the canvas — never Html-in-Canvas. */
export function ScreenAnnotations() {
  const items = useAnnoStore((s) => s.items)
  const show = useAppStore((s) => s.showLabels)
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setHost(document.querySelector('.viewport') as HTMLElement | null)
  }, [])

  if (!show || !host || !items.length) return null

  return createPortal(
    <div className="anno-layer">
      <svg className="anno-svg" width="100%" height="100%">
        {items.map((a) => {
          const stroke =
            a.tone === 'danger'
              ? '#d07070'
              : a.tone === 'warn'
                ? '#d0a050'
                : a.tone === 'ok'
                  ? '#7aab7a'
                  : '#7eb6d0'
          return (
            <g key={a.id}>
              <line
                x1={a.x}
                y1={a.y}
                x2={a.leaderX}
                y2={a.leaderY}
                stroke={stroke}
                strokeWidth="1.5"
              />
              <circle cx={a.x} cy={a.y} r="3.5" fill={stroke} />
            </g>
          )
        })}
      </svg>
      {items.map((a) => (
        <div
          key={a.id}
          className={`anno-card anno-${a.tone}`}
          style={{ left: a.cardX, top: a.cardY }}
        >
          {a.text}
        </div>
      ))}
    </div>,
    host,
  )
}
