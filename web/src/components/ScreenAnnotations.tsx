import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { annoScratch, useAnnoStore, type ScreenAnno } from '../lib/annotations'
import { useAppStore } from '../lib/store'

const OFFSET: Record<string, { lx: number; ly: number; tx: number; ty: number }> = {
  left: { lx: -36, ly: 0, tx: -168, ty: -14 },
  right: { lx: 36, ly: 0, tx: 20, ty: -14 },
  top: { lx: 0, ly: -32, tx: -80, ty: -52 },
  bottom: { lx: 0, ly: 32, tx: -80, ty: 20 },
}

const CARD_H = 36

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
    const next: ScreenAnno[] = []
    const margin = 8
    for (const a of annoScratch.values()) {
      v.set(a.world[0], a.world[1], a.world[2]).project(camera)
      if (v.z > 1) continue
      let x = (v.x * 0.5 + 0.5) * size.width
      let y = (-v.y * 0.5 + 0.5) * size.height
      x = Math.min(size.width - margin, Math.max(margin, x))
      y = Math.min(size.height - margin, Math.max(margin, y))
      next.push({
        id: a.id,
        text: a.text,
        tone: a.tone,
        side: a.side,
        x,
        y,
      })
    }

    // Prefer side slots, then push apart so cards never smear
    next.sort((a, b) => a.y - b.y || a.x - b.x)
    for (let i = 1; i < next.length; i++) {
      const prev = next[i - 1]!
      const cur = next[i]!
      if (Math.abs(cur.x - prev.x) < 160 && cur.y - prev.y < CARD_H) {
        cur.y = prev.y + CARD_H
      }
    }
    // Keep inside viewport
    for (const a of next) {
      a.y = Math.min(size.height - CARD_H - 4, Math.max(4, a.y))
      a.x = Math.min(size.width - 24, Math.max(24, a.x))
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
          const o = OFFSET[a.side] ?? OFFSET.right!
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
                x2={a.x + o.lx}
                y2={a.y + o.ly}
                stroke={stroke}
                strokeWidth="1.5"
              />
              <circle cx={a.x} cy={a.y} r="3.5" fill={stroke} />
            </g>
          )
        })}
      </svg>
      {items.map((a) => {
        const o = OFFSET[a.side] ?? OFFSET.right!
        return (
          <div
            key={a.id}
            className={`anno-card anno-${a.tone}`}
            style={{ left: a.x + o.tx, top: a.y + o.ty }}
          >
            {a.text}
          </div>
        )
      })}
    </div>,
    host,
  )
}
