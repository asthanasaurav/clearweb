const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');

let win;
let view;
const PROFILE = 'persist:clearweb-default';

async function installBlocking(ses) {
  try {
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    blocker.enableBlockingInSession(ses);
    console.log('[Clearweb] ad/tracker protection enabled');
  } catch (err) {
    console.error('[Clearweb] blocker failed open:', err);
  }
}

function normalizeUrl(input) {
  const value = input.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

async function createBrowser() {
  const ses = session.fromPartition(PROFILE, { cache: true });
  await installBlocking(ses);

  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#08111f',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  await win.loadFile(path.join(__dirname, 'ui', 'index.html'));

  view = new BrowserView({
    webPreferences: {
      partition: PROFILE,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.setBrowserView(view);

  const layout = () => {
    const [width, height] = win.getContentSize();
    view.setBounds({ x: 0, y: 104, width, height: Math.max(0, height - 104) });
    view.setAutoResize({ width: true, height: true });
  };
  layout();
  win.on('resize', layout);

  const syncState = () => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send('browser:state', {
      url: view.webContents.getURL(),
      title: view.webContents.getTitle(),
      canGoBack: view.webContents.canGoBack(),
      canGoForward: view.webContents.canGoForward()
    });
  };

  view.webContents.on('did-navigate', syncState);
  view.webContents.on('did-navigate-in-page', syncState);
  view.webContents.on('page-title-updated', syncState);
  view.webContents.setWindowOpenHandler(({ url }) => {
    view.webContents.loadURL(url);
    return { action: 'deny' };
  });

  await view.webContents.loadURL('https://www.google.com');
}

ipcMain.handle('browser:navigate', (_, input) => view.webContents.loadURL(normalizeUrl(input)));
ipcMain.handle('browser:back', () => view.webContents.canGoBack() && view.webContents.goBack());
ipcMain.handle('browser:forward', () => view.webContents.canGoForward() && view.webContents.goForward());
ipcMain.handle('browser:reload', () => view.webContents.reload());
ipcMain.handle('browser:home', () => view.webContents.loadURL('https://www.google.com'));

// Persistent partition keeps normal website cookies/storage across restarts, including
// Google sessions when the site's authentication policy permits an embedded Chromium client.
app.whenReady().then(createBrowser);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createBrowser(); });
