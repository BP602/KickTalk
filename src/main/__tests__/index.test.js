import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'path'

// Resolve absolute module paths so our mocks apply before importing main
const abs = (rel) => path.normalize(new URL(rel, import.meta.url).pathname)
const CONFIG = abs('../../../utils/config.js')
const FS = 'fs'
const TELEMETRY_INDEX = abs('../../telemetry/index.js')
const MAIN_INDEX = abs('../index.js')

// Helpers to access registered ipc handlers
const getIpcHandler = (ipcMain, channel) => {
  const call = ipcMain.handle.mock.calls.find((c) => c[0] === channel)
  if (!call) throw new Error(`IPC handler not registered for ${channel}`)
  return call[1]
}

describe('main/index.js IPC and helpers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  const setupMain = async ({ telemetryEnabled = false } = {}) => {
    // Mock config store
    const mockStore = {
      store: { lastMainWindowState: { width: 800, height: 600, x: 0, y: 0 }, zoomFactor: 1 },
      get: vi.fn((key, def) => {
        if (key === 'telemetry') return { enabled: telemetryEnabled }
        if (key === 'lastMainWindowState') return { width: 800, height: 600, x: 0, y: 0 }
        if (key === 'zoomFactor') return 1
        return def
      }),
      set: vi.fn(),
      delete: vi.fn(),
    }
    vi.doMock(CONFIG, () => ({ default: mockStore }))

    // Mock telemetry index to observe metrics calls, but respect enable gate in main
    const metrics = {
      incrementOpenWindows: vi.fn(),
      decrementOpenWindows: vi.fn(),
      recordError: vi.fn(),
      recordMessageSent: vi.fn(),
      recordMessageSendDuration: vi.fn(),
      recordMessageReceived: vi.fn(),
      recordRendererMemory: vi.fn(),
      recordDomNodeCount: vi.fn(),
      incrementWebSocketConnections: vi.fn(),
      decrementWebSocketConnections: vi.fn(),
      recordConnectionError: vi.fn(),
      recordReconnection: vi.fn(),
    }
    vi.doMock(TELEMETRY_INDEX, () => ({ initTelemetry: vi.fn(), shutdownTelemetry: vi.fn(), metrics }))

    // Ensure fs has readdirSync for sounds bootstrap
    vi.doMock(FS, () => ({
      existsSync: vi.fn(() => true),
      readFileSync: vi.fn(() => '{}'),
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
      copyFileSync: vi.fn(),
      readdirSync: vi.fn(() => ['default.wav', 'bells.wav']),
    }))

    // Extend electron mock with getAllWindows used by store:set
    const electronMod = await import('electron')
    const electron = electronMod.default || electronMod
    electron.BrowserWindow.getAllWindows = vi.fn(() => [{ webContents: { send: vi.fn() } }])

    // Import main (registers handlers)
    await import(MAIN_INDEX)

    return { electron, metrics, mockStore }
  }

  it('store:get returns whole store when no key, otherwise value', async () => {
    const { electron, mockStore } = await setupMain()
    const handler = getIpcHandler(electron.ipcMain, 'store:get')

    const all = await handler({}, { key: undefined })
    expect(all).toBe(mockStore.store)

    mockStore.get.mockClear()
    const val = await handler({}, { key: 'zoomFactor' })
    expect(mockStore.get).toHaveBeenCalledWith('zoomFactor')
    expect(val).toBe(1)
  })

  it('chatLogs:add and chatLogs:get manage user logs', async () => {
    const { electron } = await setupMain()
    const add = getIpcHandler(electron.ipcMain, 'chatLogs:add')
    const get = getIpcHandler(electron.ipcMain, 'chatLogs:get')

    const chatroomId = 'room1'
    const userId = 'u1'
    const message = { id: 'm1', created_at: '2024-01-01T00:00:00Z', text: 'hi' }

    const res = await add({}, { data: { chatroomId, userId, message } })
    expect(res).toEqual({ messages: [message] })

    const logs = await get({}, { data: { chatroomId, userId } })
    expect(Array.isArray(logs)).toBe(true)
    expect(logs).toHaveLength(1)
    expect(logs[0].id).toBe('m1')
  })

  it('telemetry:recordMessageSent calls metrics only when enabled', async () => {
    // Disabled
    let ctx = await setupMain({ telemetryEnabled: false })
    let handler = getIpcHandler(ctx.electron.ipcMain, 'telemetry:recordMessageSent')
    await handler({}, { chatroomId: 'c1', messageType: 'regular', duration: 10, success: true, streamerName: 'str' })
    expect(ctx.metrics.recordMessageSent).not.toHaveBeenCalled()
    expect(ctx.metrics.recordMessageSendDuration).not.toHaveBeenCalled()

    // Enabled
    ctx = await setupMain({ telemetryEnabled: true })
    handler = getIpcHandler(ctx.electron.ipcMain, 'telemetry:recordMessageSent')
    await handler({}, { chatroomId: 'c1', messageType: 'regular', duration: 10, success: true, streamerName: 'str' })
    expect(ctx.metrics.recordMessageSent).toHaveBeenCalledWith('c1', 'regular', 'str')
    expect(ctx.metrics.recordMessageSendDuration).toHaveBeenCalledWith(10, 'c1', true)
  })
})
