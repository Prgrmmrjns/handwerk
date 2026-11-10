import { App as CapApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import { decodeScene } from '../scene'
import { useAppStore } from './store'
import { isNativeApp } from './native'

function applyDeepLink(url: string) {
  try {
    const u = new URL(url)
    const spec = decodeScene(u.search) ?? decodeScene(u.hash)
    if (spec) {
      useAppStore.getState().setSpec(spec, 'url')
      return
    }
    // Custom scheme: handwerk://preset/scaphoid_displaced
    const parts = u.pathname.replace(/^\//, '').split('/')
    if (parts[0] === 'preset' && parts[1]) {
      const fromQuery = decodeScene(`preset=${parts[1]}`)
      if (fromQuery) useAppStore.getState().setSpec(fromQuery, 'url')
    }
  } catch {
    // ignore malformed deep links
  }
}

/** Wire Capacitor plugins: status bar, splash, back button, deep links. */
export async function bootCapacitor() {
  if (!isNativeApp()) return

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#0b1220' })
  } catch {
    // StatusBar may be unavailable on some devices
  }

  try {
    await SplashScreen.hide()
  } catch {
    /* optional */
  }

  // Android hardware back: close sheet first, then minimize
  await CapApp.addListener('backButton', ({ canGoBack }) => {
    const store = useAppStore.getState()
    if (store.sheetOpen) {
      store.setSheetOpen(false)
      return
    }
    if (canGoBack) {
      window.history.back()
      return
    }
    CapApp.minimizeApp().catch(() => {
      /* webview fallback */
    })
  })

  await CapApp.addListener('appUrlOpen', ({ url }) => {
    applyDeepLink(url)
  })

  // Cold-start deep link
  try {
    const launch = await CapApp.getLaunchUrl()
    if (launch?.url) applyDeepLink(launch.url)
  } catch {
    /* no launch URL */
  }

  // Mark body for CSS hooks
  document.documentElement.dataset.platform = Capacitor.getPlatform()
  document.documentElement.dataset.native = 'true'
}
