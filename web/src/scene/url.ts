import LZString from 'lz-string'
import { validateSceneSpec } from './validator'
import type { SceneSpec } from './schema'
import { SCENES, type PresetId } from './presets'

const PARAM = 'scene'

export function encodeScene(spec: SceneSpec): string {
  const json = JSON.stringify(spec)
  return LZString.compressToEncodedURIComponent(json)
}

export function decodeScene(hashOrQuery: string): SceneSpec | null {
  const raw = hashOrQuery.replace(/^[?#]/, '')
  const params = new URLSearchParams(
    raw.includes('=') ? raw : `scene=${raw}`,
  )
  const preset = params.get('preset')
  if (preset && preset in SCENES) {
    return SCENES[preset as PresetId]
  }
  const packed = params.get(PARAM)
  if (!packed) return null
  try {
    const json = LZString.decompressFromEncodedURIComponent(packed)
    if (!json) return null
    const result = validateSceneSpec(JSON.parse(json))
    return result.spec ?? null
  } catch {
    return null
  }
}

export function sceneToShareUrl(spec: SceneSpec, origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  // Prefer short preset URLs when possible
  if (spec.id && spec.id in SCENES) {
    return `${origin}/?preset=${encodeURIComponent(spec.id)}`
  }
  return `${origin}/?${PARAM}=${encodeScene(spec)}`
}

export function readSceneFromLocation(loc: Location = window.location): SceneSpec | null {
  return decodeScene(loc.search) ?? decodeScene(loc.hash)
}
