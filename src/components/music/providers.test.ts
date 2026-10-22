import { afterEach, expect, test, vi } from 'vitest'
import { musicError, preferredDevice, spotifyBrowserSupport } from './providers'

afterEach(() => vi.unstubAllGlobals())

test('browser support is a DRM probe, independent of the mobile UA', async () => {
  const request = vi.fn().mockResolvedValue({})
  vi.stubGlobal('navigator', { userAgent: 'Android', requestMediaKeySystemAccess: request })
  expect(await spotifyBrowserSupport()).toBe(true)
  expect(request.mock.calls[0][0]).toBe('com.widevine.alpha')
})

test('Safari can try the SDK with FairPlay; absent DRM falls back to Connect', async () => {
  const request = vi.fn().mockRejectedValueOnce(new Error('No Widevine')).mockResolvedValueOnce({})
  vi.stubGlobal('navigator', { requestMediaKeySystemAccess: request })
  expect(await spotifyBrowserSupport()).toBe(true)
  expect(request.mock.calls[1][0]).toBe('com.apple.fps')
  request.mockRejectedValue(new Error('No DRM'))
  expect(await spotifyBrowserSupport()).toBe(false)
  vi.stubGlobal('navigator', {})
  expect(await spotifyBrowserSupport()).toBe(false)
})

test('Connect prefers this phone, then last used, and never a restricted device', () => {
  const speaker = { id: 'speaker', name: 'Living room', type: 'Speaker', active: true, restricted: false }
  const phone = { id: 'phone', name: 'My iPhone', type: 'Smartphone', active: false, restricted: false }
  const blocked = { ...phone, id: 'blocked', restricted: true }
  vi.stubGlobal('navigator', { userAgent: 'iPhone' })
  expect(preferredDevice([blocked, speaker, phone], 'speaker')?.id).toBe('phone')
  vi.stubGlobal('navigator', { userAgent: 'Desktop' })
  expect(preferredDevice([speaker, phone], 'phone')?.id).toBe('phone')
  expect(preferredDevice([blocked])).toBeUndefined()
})

test('structured Spotify reasons remain visible in recovery copy', () => {
  expect(musicError({ data: { code: 'NO_DEVICE', reason: 'NO_ACTIVE_DEVICE' } })).toContain('NO_ACTIVE_DEVICE')
  expect(musicError({ data: 'PREMIUM' })).toContain('Premium')
  expect(musicError({ data: 'RECONNECT' })).toContain('revoked')
  expect(musicError({ data: 'RATE_LIMITED' })).toContain('Try again')
})
