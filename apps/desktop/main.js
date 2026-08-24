const { app, BrowserWindow, BrowserView, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { sanitizeUrl, normalizeInput } = require('../../packages/privacy/url-hygiene');
const { OllamaProvider } = require('../../packages/ai/providers/ollama');

const PROFILE = 'persist:clearweb-default';
const HOME = 'clearweb://newtab';
const CHROME_HEIGHT = 112;
const SUSPEND_AFTER_MS = Number(process.env.CLEARWEB_SUSPEND_MS || 60_000);
const PANEL_WIDTH = 414;
let win, ses, blocker, saveTimer, suspensionTimer, protectionEmitTimer;
let panelOpen = false;
let tabs = [], activeId = null, downloads = [], history = [], bookmarks = [], savedSessions = [];
let settings = { aiEnabled: true, cleanWeb: true };
const protection = { blocked: 0, trackingParamsRemoved: 0 };
const ai = new OllamaProvider({ model: process.env.CLEARWEB_QWEN_MODEL || 'qwen2.5:3b' });

const dataFile = () => path.join(app.getPath('userData'), 'clearweb-state.json');
const safeReadState = () => { try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch { return {}; } };
const persist = () => {
  const state = { version: 1, settings, bookmarks, savedSessions, history: history.slice(0, 2000), downloads: downloads.slice(0, 500), tabs: tabs.map(({ id, url, title, favicon, lastActive }) => ({ id, url, title, favicon, lastActive })), activeId };
  try { fs.mkdirSync(path.dirname(dataFile()), { recursive: true }); fs.writeFileSync(dataFile(), JSON.stringify(state, null, 2)); } catch (error) { console.error('[Clearweb] state save failed:', error); }
};
const schedulePersist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 250); };
const publicTab = (tab) => ({ id: tab.id, url: tab.url, title: tab.title, favicon: tab.favicon, suspended: !tab.view, active: tab.id === activeId });
const send = (channel, value) => { if (win && !win.isDestroyed()) win.webContents.send(channel, value); };
const activeTab = () => tabs.find((tab) => tab.id === activeId);
const activeWebContents = () => {
  const webContents = activeTab()?.view?.webContents;
  return webContents && !webContents.isDestroyed() ? webContents : null;
};
const activeIsBookmarked = () => Boolean(activeTab()?.url && bookmarks.some((bookmark) => bookmark.url === activeTab().url));
const emitState = () => {
  const webContents = activeWebContents();
  send('app:state', { tabs: tabs.map(publicTab), activeId, settings, protection, bookmarked: activeIsBookmarked(), canGoBack: webContents?.navigationHistory.canGoBack() || false, canGoForward: webContents?.navigationHistory.canGoForward() || false, provider: ai.info() });
};
const scheduleProtectionEmit = () => {
  if (protectionEmitTimer) return;
  protectionEmitTimer = setTimeout(() => { protectionEmitTimer = null; emitState(); }, 500);
};
const cleanTarget = (input) => { const clean = sanitizeUrl(normalizeInput(input)); protection.trackingParamsRemoved += clean.removed; return clean.url; };

async function installBlocking() {
  try { blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch); blocker.enableBlockingInSession(ses); blocker.on('request-blocked', () => { protection.blocked += 1; scheduleProtectionEmit(); }); }
  catch (error) { console.error('[Clearweb] blocker unavailable; continuing unblocked:', error); }
}
function boundsForView() { const [width, height] = win.getContentSize(); return { x: 0, y: CHROME_HEIGHT, width: Math.max(0, width - (panelOpen ? PANEL_WIDTH : 0)), height: Math.max(0, height - CHROME_HEIGHT) }; }
function layout() { const tab = activeTab(); if (tab?.view) tab.view.setBounds(boundsForView()); }
function newView(tab) {
  const view = new BrowserView({ webPreferences: { partition: PROFILE, contextIsolation: true, nodeIntegration: false, sandbox: true, safeDialogs: true } }); tab.view = view; view.setAutoResize({ width: true, height: true });
  const wc = view.webContents;
  wc.setWindowOpenHandler(({ url }) => { createTab(url, true); return { action: 'deny' }; });
  wc.on('will-navigate', (event, url) => { const cleaned = cleanTarget(url); if (cleaned !== url) { event.preventDefault(); wc.loadURL(cleaned).catch(() => {}); emitState(); } });
  const update = () => { if (wc.isDestroyed()) return; tab.url = wc.getURL() || tab.url; tab.title = wc.getTitle() || tab.title; schedulePersist(); emitState(); };
  wc.on('did-navigate', (_, url) => { update(); recordHistory(tab, url); applyCleanWeb(tab); }); wc.on('did-navigate-in-page', update); wc.on('page-title-updated', update);
  wc.on('page-favicon-updated', (_, icons) => { tab.favicon = icons[0] || ''; emitState(); }); wc.on('render-process-gone', () => { tab.view = null; emitState(); }); return view;
}
function recordHistory(tab, url) { if (!/^https?:/i.test(url)) return; history.unshift({ id: crypto.randomUUID(), url, title: tab.title || url, visitedAt: Date.now() }); schedulePersist(); }
async function loadTab(tab, url = tab.url) { if (url === HOME || !url) return; try { await tab.view.webContents.loadURL(cleanTarget(url)); } catch (error) { console.error('[Clearweb] navigation failed:', error.message); } }
function showNewTab(tab) { if (!tab) return; tab.url = HOME; tab.title = 'New Tab'; if (tab.view && !tab.view.webContents.isDestroyed()) tab.view.webContents.destroy(); tab.view = null; if (win.getBrowserView()) win.setBrowserView(null); emitState(); schedulePersist(); }
async function activateTab(id) {
  const previous = activeTab(); if (previous) previous.lastActive = Date.now(); const tab = tabs.find((item) => item.id === id); if (!tab) return;
  activeId = id; tab.lastActive = Date.now(); if (tab.url === HOME) showNewTab(tab); else { if (!tab.view) { newView(tab); await loadTab(tab); } win.setBrowserView(tab.view); layout(); tab.view.webContents.focus(); emitState(); } schedulePersist();
}
async function createTab(url = HOME, activate = true) { const tab = { id: crypto.randomUUID(), url: url || HOME, title: 'New Tab', favicon: '', view: null, lastActive: Date.now() }; tabs.push(tab); if (activate) await activateTab(tab.id); else emitState(); return publicTab(tab); }
function closeTab(id) { const index = tabs.findIndex((tab) => tab.id === id); if (index < 0) return; const [tab] = tabs.splice(index, 1); if (tab.view && !tab.view.webContents.isDestroyed()) tab.view.webContents.destroy(); if (!tabs.length) return createTab(); if (activeId === id) activateTab(tabs[Math.min(index, tabs.length - 1)].id); else emitState(); schedulePersist(); }
function suspendInactive() { const now = Date.now(); for (const tab of tabs) { if (tab.id === activeId || !tab.view || now - tab.lastActive < SUSPEND_AFTER_MS) continue; tab.url = tab.view.webContents.getURL() || tab.url; tab.title = tab.view.webContents.getTitle() || tab.title; tab.view.webContents.destroy(); tab.view = null; } emitState(); schedulePersist(); }
function cleanWebScript(enabled) { return `(() => { document.documentElement.classList.toggle('clearweb-clean', ${Boolean(enabled)}); let style=document.getElementById('clearweb-clean-style'); if(!style){style=document.createElement('style');style.id='clearweb-clean-style';document.documentElement.appendChild(style)} style.textContent=${Boolean(enabled)} ? \`[class*="newsletter" i],[class*="subscribe" i],[class*="social-share" i],[aria-label*="advertisement" i],[data-ad],[id^="google_ads"],[class*="cookie-banner" i]{display:none!important} video[autoplay]{visibility:hidden!important}\` : ''; if(${Boolean(enabled)})document.querySelectorAll('video[autoplay]').forEach(v=>{try{v.pause()}catch{}}); return true })()`; }
function applyCleanWeb(tab = activeTab()) { if (!tab?.view || tab.view.webContents.isDestroyed()) return; tab.view.webContents.executeJavaScript(cleanWebScript(settings.cleanWeb), true).catch(() => {}); }

async function createBrowser() {
  const restored = safeReadState(); settings = { ...settings, ...(restored.settings || {}) }; bookmarks = restored.bookmarks || []; history = restored.history || []; downloads = restored.downloads || []; savedSessions = restored.savedSessions || [];
  ses = session.fromPartition(PROFILE, { cache: true });
  installBlocking();
  ses.on('will-download', (_, item) => { const entry = { id: crypto.randomUUID(), filename: item.getFilename(), url: item.getURL(), path: '', state: 'progressing', received: 0, total: item.getTotalBytes(), startedAt: Date.now() }; downloads.unshift(entry); send('downloads:changed', downloads); schedulePersist(); item.on('updated', (_event, state) => { entry.state = state; entry.received = item.getReceivedBytes(); send('downloads:changed', downloads); }); item.once('done', (_event, state) => { entry.state = state; entry.path = item.getSavePath(); entry.received = item.getReceivedBytes(); send('downloads:changed', downloads); schedulePersist(); }); });
  win = new BrowserWindow({ width: 1440, height: 920, minWidth: 940, minHeight: 640, backgroundColor: '#090d15', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 18 }, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await win.loadFile(path.join(__dirname, 'ui', 'index.html')); win.on('resize', layout); win.on('close', persist);
  const restoredTabs = (restored.tabs || []).slice(0, 24); tabs = restoredTabs.length ? restoredTabs.map((tab) => ({ ...tab, view: null })) : [];
  if (!tabs.length) await createTab(); else await activateTab(tabs.some(t => t.id === restored.activeId) ? restored.activeId : tabs[0].id);
  suspensionTimer = setInterval(suspendInactive, 30_000); emitState();
}

ipcMain.handle('app:get-state', () => ({ tabs: tabs.map(publicTab), activeId, settings, protection, bookmarked: activeIsBookmarked(), provider: ai.info() }));
ipcMain.handle('tab:new', (_, url) => createTab(url || HOME)); ipcMain.handle('tab:activate', (_, id) => activateTab(id)); ipcMain.handle('tab:close', (_, id) => closeTab(id));
ipcMain.handle('browser:navigate', async (_, input) => { const tab = activeTab(); if (!tab) return; const url = cleanTarget(input); if (!tab.view) newView(tab); win.setBrowserView(tab.view); layout(); await loadTab(tab, url); emitState(); });
ipcMain.handle('browser:back', () => { const webContents = activeWebContents(); if (webContents?.navigationHistory.canGoBack()) webContents.navigationHistory.goBack(); });
ipcMain.handle('browser:forward', () => { const webContents = activeWebContents(); if (webContents?.navigationHistory.canGoForward()) webContents.navigationHistory.goForward(); });
ipcMain.handle('browser:reload', () => activeWebContents()?.reload());
ipcMain.handle('browser:home', () => showNewTab(activeTab()));
ipcMain.handle('settings:set', (_, patch) => { settings = { ...settings, ...patch }; applyCleanWeb(); emitState(); schedulePersist(); return settings; });
ipcMain.handle('panel:set-open', (_, open) => { panelOpen = Boolean(open); layout(); });
ipcMain.handle('library:get', () => ({ history, bookmarks, downloads, savedSessions })); ipcMain.handle('history:clear', () => { history = []; schedulePersist(); return history; });
ipcMain.handle('bookmark:toggle', () => { const tab = activeTab(); if (!tab || tab.url === HOME) return bookmarks; const index = bookmarks.findIndex((b) => b.url === tab.url); if (index >= 0) bookmarks.splice(index, 1); else bookmarks.unshift({ id: crypto.randomUUID(), url: tab.url, title: tab.title, createdAt: Date.now() }); emitState(); schedulePersist(); return bookmarks; });
ipcMain.handle('session:save', (_, name) => { savedSessions.unshift({ id: crypto.randomUUID(), name: name || `Session ${savedSessions.length + 1}`, createdAt: Date.now(), tabs: tabs.map(({ url, title }) => ({ url, title })) }); schedulePersist(); return savedSessions; });
ipcMain.handle('session:restore', async (_, id) => { const snapshot = savedSessions.find(s => s.id === id); if (!snapshot) return; const added = []; for (const item of snapshot.tabs) added.push(await createTab(item.url, false)); if (added.length) await activateTab(added[0].id); }); ipcMain.handle('download:open', (_, filePath) => filePath && shell.openPath(filePath));
ipcMain.handle('ai:ask', async (_, { prompt, pageText }) => { if (!settings.aiEnabled) return { ok: false, error: 'AI Assistant is disabled.' }; try { return { ok: true, text: await ai.ask({ prompt, context: String(pageText || '').slice(0, 18_000) }) }; } catch (error) { return { ok: false, error: error.message, hint: 'Start Ollama and install the configured Qwen model. Browsing remains fully functional.' }; } });
ipcMain.handle('page:extract', async () => { const tab = activeTab(); if (!tab?.view) return ''; try { return await tab.view.webContents.executeJavaScript(`document.body?.innerText?.slice(0,18000)||''`, true); } catch { return ''; } });
app.whenReady().then(createBrowser); app.on('before-quit', () => { clearInterval(suspensionTimer); persist(); }); app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); }); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createBrowser(); });
