// Electron test mock used via Vite alias for main-process tests
// Provide both named and default exports

export const app = {
  getName: () => 'KickTalk',
  getVersion: () => '1.1.8',
  getPath: (p) => `/mock/path/${p}`,
  isPackaged: false,
  whenReady: async () => {},
  on: () => {},
  quit: () => {},
  setAppUserModelId: () => {},
}

export const shell = { openExternal: () => {} }

export const screen = { getDisplayNearestPoint: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }) }

export const session = {
  defaultSession: {
    clearStorageData: async () => {},
    cookies: { get: async () => [] },
  }
}

function makeBrowserWindowInstance() {
  return {
    loadFile: () => {},
    loadURL: () => {},
    on: () => {},
    once: (evt, cb) => { if (evt === 'ready-to-show') cb() },
    show: () => {},
    close: () => {},
    focus: () => {},
    setThumbarButtons: () => {},
    setAlwaysOnTop: () => {},
    setVisibleOnAllWorkspaces: () => {},
    setFullScreenable: () => {},
    isAlwaysOnTop: () => false,
    isMaximized: () => false,
    minimize: () => {},
    maximize: () => {},
    unmaximize: () => {},
    getPosition: () => [0, 0],
    getSize: () => [800, 600],
    getNormalBounds: () => ({ width: 800, height: 600, x: 0, y: 0 }),
    webContents: {
      send: () => {},
      on: () => {},
      openDevTools: () => {},
      setWindowOpenHandler: () => ({ action: 'deny' }),
      setZoomFactor: () => {},
      getZoomFactor: () => 1,
      reload: () => {},
      executeJavaScript: async () => {},
    },
  }
}

export function BrowserWindow() {
  return BrowserWindow.instance
}
BrowserWindow.instance = makeBrowserWindowInstance()
BrowserWindow.getAllWindows = () => [BrowserWindow.instance]

export const ipcMain = (() => {
  const calls = { handle: [], on: [] }
  return {
    handle: (...args) => { calls.handle.push(args) },
    on: (...args) => { calls.on.push(args) },
    setMaxListeners: () => {},
    removeAllListeners: () => {},
    handleOnce: () => {},
    get _calls() { return calls }
  }
})()

export const Menu = { setApplicationMenu: () => {}, buildFromTemplate: () => {} }
export function Tray() { return { setToolTip: () => {}, setContextMenu: () => {} } }
export const dialog = { showOpenDialog: async () => ({ canceled: true, filePaths: [] }), showMessageBox: async () => ({ response: 0 }) }
export const nativeImage = { createFromPath: () => ({}) }

const electron = { app, shell, screen, session, BrowserWindow, ipcMain, Menu, Tray, dialog, nativeImage }
export default electron
module.exports.__esModule = true
