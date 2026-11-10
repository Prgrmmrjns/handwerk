import { Capacitor } from '@capacitor/core'

/** True when running inside a Capacitor native shell (Android / iOS). */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/** Hosted parse endpoint for native builds (no local Vercel function). */
export const HOSTED_PARSE_URL = 'https://handwerk-ruddy.vercel.app/api/parse'

export function parseApiUrl(): string {
  if (isNativeApp()) return HOSTED_PARSE_URL
  // Capacitor Android uses https://localhost — still needs the absolute API
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    if (protocol === 'capacitor:' || protocol === 'file:') return HOSTED_PARSE_URL
    if (hostname === 'localhost' && Capacitor.getPlatform() === 'android') return HOSTED_PARSE_URL
  }
  return '/api/parse'
}

/** Public web origin used for share / deep-link URLs from the native app. */
export function shareOrigin(): string {
  if (isNativeApp()) return 'https://handwerk-ruddy.vercel.app'
  if (typeof window === 'undefined') return 'https://handwerk-ruddy.vercel.app'
  const { origin, protocol } = window.location
  if (protocol === 'capacitor:' || protocol === 'file:' || !origin || origin === 'null') {
    return 'https://handwerk-ruddy.vercel.app'
  }
  return origin
}
