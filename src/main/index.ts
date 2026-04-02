import { app, shell, BrowserWindow, ipcMain, nativeTheme, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase, getDatabase } from './database'
import { registerIpcHandlers } from './ipc'
import { pathToFileURL } from 'url'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register custom protocol for serving local files safely
protocol.registerSchemesAsPrivileged([
  { scheme: 'atlyx-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
])

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Handle atlyx-file:// protocol to serve local files
  protocol.handle('atlyx-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('atlyx-file://', ''))
    return net.fetch(pathToFileURL(filePath).href)
  })

  // Initialize database and IPC
  initDatabase()
  registerIpcHandlers()

  // Set app name (shows in macOS menu bar)
  app.name = 'Atlyx'

  // Restore persisted theme preference
  const db = getDatabase()
  const themeRow = db.prepare("SELECT value FROM settings WHERE key = 'theme'").get() as
    | { value: string }
    | undefined
  nativeTheme.themeSource = (themeRow?.value as 'system' | 'dark' | 'light') ?? 'system'
  // Set default storage path if not configured
  const spRow = db.prepare("SELECT value FROM settings WHERE key = 'storagePath'").get() as
    | { value: string }
    | undefined
  if (!spRow) {
    const defaultPath = join(app.getPath('documents'), 'Atlyx')
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('storagePath', ?)").run(
      defaultPath
    )
  }
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
