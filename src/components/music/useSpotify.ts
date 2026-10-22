import { useAction } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../convex/_generated/api'
import { announce } from '#/lib/announce'
import { loadSpotify, musicError, musicErrorCode, preferredDevice, spotifyBrowserSupport, type Item, type SpotifyPlayer } from './providers'

type Playback = FunctionReturnType<typeof api.spotify.playback>
type Devices = FunctionReturnType<typeof api.spotify.devices>
type Command = 'play' | 'pause' | 'next' | 'previous'
type Selection = { uris?: string[]; contextUri?: string; item?: Item }

/** A single session owns the SDK and Connect controls for the whole workout. */
export function useSpotify({ connected, enabled, online, onError }: {
  connected: boolean; enabled: boolean; online: boolean; onError: (message: string) => void
}) {
  const getPlayback = useAction(api.spotify.playback), getDevices = useAction(api.spotify.devices)
  const control = useAction(api.spotify.control), getToken = useAction(api.spotify.sdkToken)
  const [playback, setPlayback] = useState<Playback | null>(null)
  const [devices, setDevices] = useState<Devices>([])
  const [selected, setSelected] = useState<Item | undefined>()
  const [busy, setBusy] = useState(false), [noDevice, setNoDevice] = useState(false)
  const [support, setSupport] = useState<boolean | null>(null), [browserDevice, setBrowserDevice] = useState('')
  const [sdkFailure, setSdkFailure] = useState('')
  const player = useRef<SpotifyPlayer | null>(null)
  const startPromise = useRef<Promise<string> | null>(null)
  const rejectStart = useRef<((error: Error) => void) | null>(null)
  const device = useRef<string | undefined>(undefined)
  const manualDevice = useRef(false), failedSDK = useRef(false), alive = useRef(true), acting = useRef(false)
  const version = useRef(0), reconcileTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef<Selection | undefined>(undefined)
  const latestError = useRef(onError); latestError.current = onError

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false; rejectStart.current?.(new Error('Player closed'))
      player.current?.disconnect(); clearTimeout(reconcileTimer.current)
    }
  }, [])
  useEffect(() => {
    if (!connected) {
      player.current?.disconnect(); player.current = null; startPromise.current = null
      rejectStart.current?.(new Error('Disconnected')); device.current = undefined
      setPlayback(null); setSelected(undefined); setBrowserDevice(''); setNoDevice(false)
      failedSDK.current = false; setSdkFailure('')
      return
    }
    let cancelled = false
    void spotifyBrowserSupport().then(ok => {
      if (cancelled) return
      setSupport(ok)
      // Preload only after consent; activateElement still runs in the play gesture.
      if (ok) void loadSpotify().catch(() => {})
    })
    return () => { cancelled = true }
  }, [connected])

  const refresh = useCallback(async () => {
    const v = version.current
    const result = await getPlayback({})
    if (alive.current && v === version.current) {
      setPlayback(result)
      if (result.item) setSelected(undefined)
    }
    return result
  }, [getPlayback])

  useEffect(() => {
    if (!connected || !enabled || !online) return
    let stopped = false, timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (document.visibilityState !== 'visible') return
      try { await refresh() } catch (e) { if (!stopped) latestError.current(musicError(e)) }
      if (!stopped) timer = setTimeout(poll, 15_000)
    }
    const visible = () => { clearTimeout(timer); void poll() }
    void poll(); document.addEventListener('visibilitychange', visible)
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible) }
  }, [connected, enabled, online, refresh])

  const startBrowser = async (): Promise<string> => {
    // Calling this before an await retains the user's audio-unlock gesture.
    if (player.current) void player.current.activateElement().catch(() => {})
    if (browserDevice) return browserDevice
    if (startPromise.current) return startPromise.current
    if (failedSDK.current || !(support ?? await spotifyBrowserSupport())) throw new Error('Browser DRM unavailable')
    const promise = (async () => {
      await loadSpotify()
      if (!alive.current || !window.Spotify) throw new Error('Spotify SDK unavailable')
      const p = new window.Spotify.Player({ name: 'Lift · this browser', volume: 0.7, getOAuthToken: cb => {
        void getToken({}).then(t => { if (alive.current) cb(t.accessToken) }).catch(e => rejectStart.current?.(new Error(musicError(e))))
      } })
      player.current = p
      return await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => fail('Spotify browser player timed out'), 15_000)
        const fail = (message: string) => {
          clearTimeout(timer); rejectStart.current = null; p.disconnect()
          if (player.current === p) player.current = null
          failedSDK.current = true
          if (alive.current) { setBrowserDevice(''); setSdkFailure(message) }
          reject(new Error(message))
        }
        rejectStart.current = e => fail(e.message)
        for (const event of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) {
          p.addListener(event, e => {
            const message = `Spotify ${event}: ${e.message ?? 'browser playback unavailable'}`
            fail(message)
            latestError.current(message)
          })
        }
        p.addListener('ready', ({ device_id }) => {
          if (!device_id || !alive.current) return
          clearTimeout(timer); rejectStart.current = null
          setBrowserDevice(device_id); resolve(device_id)
        })
        p.addListener('not_ready', () => {
          if (alive.current) { setBrowserDevice(''); setSdkFailure('Spotify browser player disconnected. Tap Retry to find a device.'); latestError.current('Spotify browser player disconnected. Tap Retry to find a device.') }
          if (device.current === browserDevice) device.current = undefined
          p.disconnect(); player.current = null; startPromise.current = null; failedSDK.current = true
        })
        p.addListener('autoplay_failed', () => latestError.current('Spotify needs another tap. Tap Play music to allow audio in this browser.'))
        void p.activateElement().catch(() => {})
        void p.connect().then(ok => { if (!ok) fail('Spotify SDK could not connect') }).catch(e => fail(musicError(e)))
      })
    })()
    startPromise.current = promise
    try { return await promise } finally { startPromise.current = null }
  }

  const listDevices = async () => {
    const result = await getDevices({}); if (alive.current) setDevices(result)
    return result
  }
  const resolveDevice = async (startSDK: boolean) => {
    if (startSDK && !manualDevice.current && !failedSDK.current) {
      try { return await startBrowser() } catch { /* A Connect device remains usable without browser DRM. */ }
    }
    const result = await listDevices()
    if (manualDevice.current) {
      const chosen = result.find(d => d.id === device.current && !d.restricted)
      if (chosen) return chosen.id
    }
    let last: string | undefined
    try { last = localStorage.getItem('lift:spotify-device') ?? undefined } catch { /* private browsing */ }
    const best = preferredDevice(result, device.current ?? last)
    if (!best) { setNoDevice(true); throw { data: { code: 'NO_DEVICE', reason: 'NO_ACTIVE_DEVICE' } } }
    return best.id
  }
  const act = async (command: Command, selection?: Selection, explicit = true) => {
    if (acting.current || !online || !connected) return false
    acting.current = true; setBusy(true); onError('')
    if (selection) { pending.current = selection; setSelected(selection.item) }
    const v = ++version.current
    try {
      let id = device.current
      if (command === 'play') {
        id = await resolveDevice(true)
        if (id !== device.current || !playback?.deviceId) {
          await control({ command: 'transfer', deviceId: id })
          // Spotify doesn't guarantee ordering across different player endpoints.
          await new Promise(resolve => setTimeout(resolve, 400))
        }
      } else if (!id) id = (await getPlayback({})).deviceId ?? await resolveDevice(false)
      if (!alive.current) return false
      device.current = id
      const request = selection ?? (command === 'play' ? pending.current : undefined)
      await control({ command, deviceId: id, uris: request?.uris, contextUri: request?.contextUri })
      if (!alive.current) return false
      setNoDevice(false); pending.current = undefined
      try { if (id) localStorage.setItem('lift:spotify-device', id) } catch { /* optional preference */ }
      if (command === 'pause' || command === 'play') setPlayback(old => ({
        ...(old ?? { progressMs: 0, durationMs: 0, restricted: false }),
        item: request?.item?.kind === 'track' ? request.item : old?.item,
        playing: command === 'play', deviceId: id,
        device: id === browserDevice ? 'Lift · this browser' : devices.find(d => d.id === id)?.name ?? old?.device,
      }))
      if (explicit) announce(command === 'pause' ? 'Music paused' : command === 'next' ? 'Next song' : command === 'previous' ? 'Previous song' : 'Music playing')
      clearTimeout(reconcileTimer.current)
      reconcileTimer.current = setTimeout(() => { if (alive.current && v === version.current) void refresh().catch(e => onError(musicError(e))) }, 1200)
      return true
    } catch (e) {
      if (musicErrorCode(e).includes('NO_DEVICE')) { setNoDevice(true); device.current = undefined }
      onError(musicError(e))
      return false
    } finally { acting.current = false; if (alive.current) setBusy(false) }
  }
  const actRef = useRef(act); actRef.current = act
  // If the user activated Spotify while away, discover it promptly upon return.
  useEffect(() => {
    if (!noDevice || !online || !enabled) return
    let cancelled = false, timer: ReturnType<typeof setTimeout>
    const check = async (attempt: number) => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        const available = await getDevices({})
        const found = preferredDevice(available, device.current)
        if (found) {
          if (cancelled) return
          device.current = found.id; setDevices(available); setNoDevice(false)
          if (pending.current) void actRef.current('play', pending.current, false)
          return
        }
      } catch (e) { if (!cancelled) latestError.current(musicError(e)) }
      if (!cancelled && attempt < 4) timer = setTimeout(() => void check(attempt + 1), 2000)
    }
    const visible = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); void check(0) } }
    document.addEventListener('visibilitychange', visible)
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', visible) }
  }, [noDevice, online, enabled, getDevices])

  const chooseDevice = async (id: string) => {
    if (acting.current) return
    setBusy(true); onError('')
    try {
      await control({ command: 'transfer', deviceId: id }); device.current = id
      manualDevice.current = id !== browserDevice; setNoDevice(false); await refresh()
      announce('Playback device selected')
    } catch (e) { onError(musicError(e)) } finally { setBusy(false) }
  }
  return { playback, item: selected ?? playback?.item, devices, busy, noDevice, support, sdkFailure, browserDevice,
    act, chooseDevice, listDevices, retry: () => act('play', pending.current),
    useBrowser: async () => { manualDevice.current = false; failedSDK.current = false; await act('play', pending.current) },
  }
}
