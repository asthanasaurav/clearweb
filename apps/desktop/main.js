const { app, BrowserWindow, BrowserView, ipcMain, session } = require('electron');
const path = require('path');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { sanitizeUrl } = require('../../packages/privacy/url-hygiene');

let win;
let view;
let blocker;
const PROFILE = 'persist:clearweb-default';
const stats = { blocked:0, trackingParamsRemoved:0, aiEnabled:true, cleanWeb:true };

function sendProtection() {
  if (win && !win.isDestroyed()) win.webContents.send('protection:state', { ...stats });
}

async function installBlocking(ses) {
  try {
    blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    blocker.enableBlockingInSession(ses);
    blocker.on('request-blocked', () => { stats.blocked++; sendProtection(); });
    console.log('[Clearweb] ad/tracker protection enabled');
  } catch (err) {
    console.error('[Clearweb] blocker failed open:', err);
  }
}

function normalizeUrl(input) {
  const value = input.trim();
  let target;
  if (/^https?:\/\//i.test(value)) target = value;
  else if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) target = `https://${value}`;
  else target = `https://www.google.com/search?q=${encodeURIComponent(value)}`;
  const clean = sanitizeUrl(target);
  stats.trackingParamsRemoved += clean.removed;
  sendProtection();
  return clean.url;
}

async function createBrowser() {
  const ses = session.fromPartition(PROFILE, { cache:true });
  await installBlocking(ses);

  win = new BrowserWindow({
    width:1440, height:920, minWidth:900, minHeight:650,
    backgroundColor:'#08111f', titleBarStyle:'hiddenInset',
    webPreferences:{ preload:path.join(__dirname,'preload.js'), contextIsolation:true, nodeIntegration:false, sandbox:true }
  });
  await win.loadFile(path.join(__dirname,'ui','index.html'));

  view = new BrowserView({ webPreferences:{ partition:PROFILE, contextIsolation:true, nodeIntegration:false, sandbox:true } });
  win.setBrowserView(view);
  const layout = () => { const [width,height]=win.getContentSize(); view.setBounds({x:0,y:104,width,height:Math.max(0,height-104)}); view.setAutoResize({width:true,height:true}); };
  layout(); win.on('resize',layout);

  const syncState = () => win.webContents.send('browser:state',{ url:view.webContents.getURL(), title:view.webContents.getTitle(), canGoBack:view.webContents.canGoBack(), canGoForward:view.webContents.canGoForward() });
  view.webContents.on('did-navigate',syncState);
  view.webContents.on('did-navigate-in-page',syncState);
  view.webContents.on('page-title-updated',syncState);
  view.webContents.setWindowOpenHandler(({url}) => { view.webContents.loadURL(normalizeUrl(url)); return {action:'deny'}; });
  sendProtection();
  await view.webContents.loadURL('https://www.google.com');
}

ipcMain.handle('browser:navigate',(_,input)=>view.webContents.loadURL(normalizeUrl(input)));
ipcMain.handle('browser:back',()=>view.webContents.canGoBack()&&view.webContents.goBack());
ipcMain.handle('browser:forward',()=>view.webContents.canGoForward()&&view.webContents.goForward());
ipcMain.handle('browser:reload',()=>view.webContents.reload());
ipcMain.handle('browser:home',()=>view.webContents.loadURL('https://www.google.com'));
ipcMain.handle('protection:get',()=>({...stats}));

// The persistent partition stores normal cookies/local storage across restarts.
app.whenReady().then(createBrowser);
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createBrowser();});
