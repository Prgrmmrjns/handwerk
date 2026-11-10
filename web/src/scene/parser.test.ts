import { describe, expect, it } from 'vitest'
import { parseRequest } from './parser'
import { validateSceneSpec } from './validator'
import { SCENES } from './presets'
import { encodeScene, decodeScene } from './url'

describe('validateSceneSpec', () => {
  it('accepts preset scenes', () => {
    for (const spec of Object.values(SCENES)) {
      const result = validateSceneSpec(spec)
      expect(result.ok, result.issues.map((i) => i.message).join('; ')).toBe(true)
      expect(result.spec?.version).toBe(1)
    }
  })

  it('rejects missing title', () => {
    const result = validateSceneSpec({ version: 1 })
    expect(result.ok).toBe(false)
  })

  it('clamps extreme wrist flexion with a warning', () => {
    const result = validateSceneSpec({
      version: 1,
      title: 'Overflex',
      pose: [{ bone: 'Wrist_Radiocarpal', rotationDeg: [200, 0, 0] }],
    })
    expect(result.ok).toBe(true)
    expect(result.issues.some((i) => i.severity === 'warning')).toBe(true)
    const pose = result.spec?.pose
    expect(Array.isArray(pose)).toBe(true)
    if (Array.isArray(pose)) {
      expect(pose[0]!.rotationDeg[0]).toBeLessThan(200)
    }
  })
})

describe('parseRequest (offline rules)', () => {
  it('parses displaced scaphoid with screw', () => {
    const r = parseRequest('show a displaced scaphoid waist fracture healing with a screw')
    expect(r.ok).toBe(true)
    expect(r.source).toBe('rules')
    const inj = r.spec?.injuries?.[0]
    expect(inj?.type).toBe('scaphoid_fracture')
    if (inj?.type === 'scaphoid_fracture') {
      expect(inj.displaced).toBe(true)
      expect(inj.fixation).toBe('herbert_screw')
      expect(inj.location).toBe('waist')
    }
  })

  it('parses non-displaced scaphoid', () => {
    const r = parseRequest('non-displaced scaphoid fracture')
    expect(r.ok).toBe(true)
    const inj = r.spec?.injuries?.[0]
    expect(inj?.type).toBe('scaphoid_fracture')
    if (inj?.type === 'scaphoid_fracture') {
      expect(inj.displaced).toBe(false)
    }
  })

  it('parses fist then wrist flexion angle', () => {
    const r = parseRequest('make a fist then flex the wrist 60°')
    expect(r.ok).toBe(true)
    expect(r.spec?.keyframes?.length).toBeGreaterThan(1)
    expect(r.spec?.title).toMatch(/60/)
  })

  it('parses boxer fracture', () => {
    const r = parseRequest("boxer's fracture")
    expect(r.spec?.injuries?.[0]?.type).toBe('boxers_fracture')
  })

  it('parses scapholunate injury', () => {
    const r = parseRequest('scapholunate ligament injury with gap')
    expect(r.spec?.injuries?.[0]?.type).toBe('scapholunate_injury')
  })

  it('falls back gracefully', () => {
    const r = parseRequest('xyzzy unrelated gibberish')
    expect(r.ok).toBe(true)
    expect(r.spec?.title).toBeTruthy()
  })
})

describe('shareable URL encoding', () => {
  it('round-trips a custom scene', () => {
    const spec = validateSceneSpec({
      version: 1,
      title: 'Custom',
      pose: 'fist',
      highlights: ['Scaphoid'],
    }).spec!
    const packed = encodeScene(spec)
    const decoded = decodeScene(`scene=${packed}`)
    expect(decoded?.title).toBe('Custom')
    expect(decoded?.pose).toBe('fist')
  })

  it('reads preset query param', () => {
    const decoded = decodeScene('preset=scaphoid_screw')
    expect(decoded?.id).toBe('scaphoid_screw')
  })
})
