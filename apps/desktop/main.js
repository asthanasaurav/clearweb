const { app, BrowserWindow, WebContentsView, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { sanitizeUrl, normalizeInput } = require('../../packages/privacy/url-hygiene');
const { OllamaProvider } = require('../../packages/ai/providers/ollama');
const { buildCleanWebScript } = require('../../packages/clean-web/inject');
const { getWeatherContext } = require('../../packages/ai/tools/weather');
const { LocalCaptureStore } = require('../../packages/training/capture-store');

const PROFILE = 'persist:clearweb-default';
const CHROME_VERSION = process.env.CLEARWEB_COMPAT_CHROME_VERSION || '151.0.0.0';
const CHROME_MAJOR = CHROME_VERSION.split('.')[0];
const COMPAT_USER_AGENT = `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROME_VERSION} Safari/537.36`;
app.userAgentFallback = COMPAT_USER_AGENT;
const HOME = 'clearweb://newtab';
const CHROME_HEIGHT = 112;
const SUSPEND_AFTER_MS = Number(process.env.CLEARWEB_SUSPEND_MS || 15 * 60_000);
const MAX_LIVE_TABS = Number(process.env.CLEARWEB_MAX_LIVE_TABS || 8);
const PANEL_WIDTH = 414;
let win, ses, blocker, saveTimer, suspensionTimer, protectionEmitTimer, lastStateJson, captureStore;
let blockingInstalled = false, compatibilityInstalled = false;
let panelOpen = false;
let tabs = [], activeId = null, downloads = [], history = [], bookmarks = [], savedSessions = [];
let settings = { aiEnabled: true, cleanWeb: true, trainingCapture: false };
const protection = { blocked: 0, trackingParamsRemoved: 0 };
const blockedRequests = [];
const ai = new OllamaProvider({ model: process.env.CLEARWEB_QWEN_MODEL || 'qwen2.5:3b' });

const dataFile = () => path.join(app.getPath('userData'), 'clearweb-state.json');
const safeReadState = () => { try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')); } catch { return {}; } };
const persist = () => {
  const state = { version: 1, settings, bookmarks, savedSessions, history: history.slice(0, 2000), downloads: downloads.slice(0, 500), tabs: tabs.map(({ id, url, title, favicon, lastActive }) => ({ id, url, title, favicon, lastActive })), activeId };
  try { fs.mkdirSync(path.dirname(dataFile()), { recursive: true }); fs.writeFileSync(dataFile(), JSON.stringify(state, null, 2)); } catch (error) { console.error('[Clearweb] state save failed:', error); }
};
const schedulePersist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 250); };
const publicTab = (tab) => ({ id: tab.id, url: tab.url, title: tab.title, favicon: tab.favicon, suspended: !tab.view, loading: Boolean(tab.loading), active: tab.id === activeId });
const send = (channel, value) => { if (win && !win.isDestroyed()) win.webContents.send(channel, value); };
const activeTab = () => tabs.find((tab) => tab.id === activeId);
const activeWebContents = () => {
  const webContents = activeTab()?.view?.webContents;
  return webContents && !webContents.isDestroyed() ? webContents : null;
};
const activeIsBookmarked = () => Boolean(activeTab()?.url && bookmarks.some((bookmark) => bookmark.url === activeTab().url));
const buildState = () => {
  const webContents = activeWebContents();
  return { tabs: tabs.map(publicTab), activeId, settings, protection, bookmarked: activeIsBookmarked(), canGoBack: webContents?.navigationHistory.canGoBack() || false, canGoForward: webContents?.navigationHistory.canGoForward() || false, provider: ai.info() };
};
const emitState = (force = false) => {
  const state = buildState(); const json = JSON.stringify(state);
  if (!force && json === lastStateJson) return;
  lastStateJson = json; send('app:state', state);
};
const scheduleProtectionEmit = () => {
  if (protectionEmitTimer) return;
  protectionEmitTimer = setTimeout(() => { protectionEmitTimer = null; send('protection:changed', { ...protection }); }, 500);
};
const cleanTarget = (input) => { const clean = sanitizeUrl(normalizeInput(input)); protection.trackingParamsRemoved += clean.removed; return clean.url; };

async function installBlocking() {
  if (blockingInstalled) return;
  blockingInstalled = true;
  try { blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch); blocker.updateFromDiff({ added: ['||youtube.com/api/stats/ads$xhr', '||youtube.com/pagead/$xhr', '||youtube.com/ptracking$xhr', '||google.com/pagead/$xhr', '||doubleclick.net^', '||googlesyndication.com^'] }); blocker.enableBlockingInSession(ses); blocker.on('request-blocked', (request) => { protection.blocked += 1; blockedRequests.unshift({ url: request?.url || '', host: request?.hostname || '', source: request?.sourceHostname || '', type: request?.type || 'other', blockedAt: Date.now() }); if (blockedRequests.length > 500) blockedRequests.length = 500; captureStore?.record(request, { pageDomain: request?.sourceHostname, outcome: 'observed_blocked', source: 'ghostery', listMatches: ['ghostery'] }); scheduleProtectionEmit(); }); }
  catch (error) { blockingInstalled = false; console.error('[Clearweb] blocker unavailable; continuing unblocked:', error); }
}
function installTrainingCapture() {
  captureStore = new LocalCaptureStore({ filePath: path.join(app.getPath('userData'), 'model-data', 'captured.jsonl'), isEnabled: () => settings.trainingCapture });
  ses.webRequest.onCompleted({ urls: ['http://*/*', 'https://*/*'] }, (details) => {
    const tab = tabs.find((item) => item.view?.webContents?.id === details.webContentsId);
    captureStore.record(details, { pageUrl: tab?.url, outcome: 'observed_allowed', source: 'browser', userContext: details.resourceType === 'mainFrame' ? 'user_navigation' : 'automatic_page_load' });
  });
}
function installSiteCompatibility() {
  if (compatibilityInstalled) return;
  ses.setUserAgent(COMPAT_USER_AGENT, 'en-US,en;q=0.9');
  ses.webRequest.onBeforeSendHeaders({ urls: ['*://*.magicbricks.com/*', '*://magicbricks.com/*'] }, (details, callback) => {
    const headers = { ...details.requestHeaders, 'User-Agent': COMPAT_USER_AGENT, 'Sec-CH-UA': `"Chromium";v="${CHROME_MAJOR}", "Google Chrome";v="${CHROME_MAJOR}", "Not=A?Brand";v="24"`, 'Sec-CH-UA-Mobile': '?0', 'Sec-CH-UA-Platform': '"macOS"' };
    callback({ requestHeaders: headers });
  });
  compatibilityInstalled = true;
}
function boundsForView() { const [width, height] = win.getContentSize(); return { x: 0, y: CHROME_HEIGHT, width: Math.max(0, width - (panelOpen ? PANEL_WIDTH : 0)), height: Math.max(0, height - CHROME_HEIGHT) }; }
function layout() { const tab = activeTab(); if (tab?.view && tab.attached) tab.view.setBounds(boundsForView()); }
function detachView(tab) { if (!tab?.view || !tab.attached) return; tab.view.setVisible(false); }
function attachView(tab) { if (!tab?.view || !win || win.isDestroyed()) return; if (!tab.attached) { win.contentView.addChildView(tab.view); tab.attached = true; } tab.view.setVisible(true); layout(); }
function destroyView(tab) { if (!tab?.view) return; if (tab.attached && win && !win.isDestroyed()) win.contentView.removeChildView(tab.view); const wc = tab.view.webContents; if (!wc.isDestroyed()) wc.close(); tab.view = null; tab.attached = false; }
function newView(tab) {
  const view = new WebContentsView({ webPreferences: { partition: PROFILE, contextIsolation: true, nodeIntegration: false, sandbox: true, safeDialogs: true, backgroundThrottling: true } }); tab.view = view; tab.attached = false; view.setVisible(false);
  const wc = view.webContents;
  wc.setWindowOpenHandler(({ url }) => { createTab(url, true); return { action: 'deny' }; });
  wc.on('will-navigate', (event, url) => { const cleaned = cleanTarget(url); if (cleaned !== url) { event.preventDefault(); wc.loadURL(cleaned).catch(() => {}); emitState(); } });
  const update = () => { if (wc.isDestroyed()) return; tab.url = wc.getURL() || tab.url; tab.title = wc.getTitle() || tab.title; schedulePersist(); emitState(); };
  wc.on('did-navigate', (_, url) => { update(); recordHistory(tab, url); applyCleanWeb(tab); }); wc.on('did-navigate-in-page', update); wc.on('page-title-updated', update);
  wc.on('dom-ready', () => applyCleanWeb(tab));
  wc.on('did-finish-load', () => { if (/magicbricks\.com$/i.test(new URL(wc.getURL()).hostname) && /access denied/i.test(wc.getTitle())) send('site:compatibility', { site: 'MagicBricks', url: wc.getURL(), message: 'MagicBricks blocks Electron browsers at its Akamai edge. Open this page in Chrome to continue.' }); });
  wc.on('did-start-loading', () => { tab.loading = true; emitState(); });
  wc.on('did-stop-loading', () => { tab.loading = false; emitState(); });
  wc.on('page-favicon-updated', (_, icons) => { tab.favicon = icons[0] || ''; emitState(); }); wc.on('render-process-gone', () => { if (tab.view === view) { if (tab.attached && win && !win.isDestroyed()) win.contentView.removeChildView(view); tab.view = null; tab.attached = false; } emitState(); }); return view;
}
function recordHistory(tab, url) { if (!/^https?:/i.test(url)) return; history.unshift({ id: crypto.randomUUID(), url, title: tab.title || url, visitedAt: Date.now() }); schedulePersist(); }
async function loadTab(tab, url = tab.url) { if (url === HOME || !url) return; try { await tab.view.webContents.loadURL(cleanTarget(url)); } catch (error) { console.error('[Clearweb] navigation failed:', error.message); } }
function showNewTab(tab) { if (!tab) return; tab.url = HOME; tab.title = 'New Tab'; destroyView(tab); emitState(); schedulePersist(); }
async function activateTab(id) {
  const previous = activeTab(); if (previous) { previous.lastActive = Date.now(); if (previous.id !== id) detachView(previous); } const tab = tabs.find((item) => item.id === id); if (!tab) return;
  activeId = id; tab.lastActive = Date.now(); if (tab.url === HOME) showNewTab(tab); else {
    const needsRestore = !tab.view;
    if (needsRestore) newView(tab);
    attachView(tab); emitState(); tab.view.webContents.focus();
    if (needsRestore) loadTab(tab);
  } schedulePersist();
}
async function createTab(url = HOME, activate = true) { const tab = { id: crypto.randomUUID(), url: url || HOME, title: 'New Tab', favicon: '', view: null, attached: false, lastActive: Date.now() }; tabs.push(tab); if (activate) await activateTab(tab.id); else emitState(); return publicTab(tab); }
function closeTab(id) { const index = tabs.findIndex((tab) => tab.id === id); if (index < 0) return; const [tab] = tabs.splice(index, 1); destroyView(tab); if (!tabs.length) return createTab(); if (activeId === id) activateTab(tabs[Math.min(index, tabs.length - 1)].id); else emitState(); schedulePersist(); }
function suspendInactive() {
  const now = Date.now();
  const liveInactive = tabs.filter((tab) => tab.id !== activeId && tab.view).sort((a, b) => b.lastActive - a.lastActive);
  liveInactive.forEach((tab, index) => {
    if (index < MAX_LIVE_TABS - 1 && now - tab.lastActive < SUSPEND_AFTER_MS) return;
    tab.url = tab.view.webContents.getURL() || tab.url; tab.title = tab.view.webContents.getTitle() || tab.title;
    destroyView(tab); tab.loading = false;
  });
  emitState(); schedulePersist();
}
function applyCleanWeb(tab = activeTab()) { if (!tab?.view || tab.view.webContents.isDestroyed()) return; tab.view.webContents.executeJavaScript(buildCleanWebScript(settings.cleanWeb), true).catch(() => {}); }
function warmRestoredTabs() {
  const queue = tabs.filter((tab) => tab.id !== activeId && tab.url !== HOME && !tab.view).slice(0, Math.max(0, MAX_LIVE_TABS - 1));
  const warmNext = () => { if (!queue.length || !win || win.isDestroyed()) return; const tab = queue.shift(); newView(tab); loadTab(tab).finally(() => setTimeout(warmNext, 350)); };
  setTimeout(warmNext, 800);
}

async function createBrowser() {
  const restored = safeReadState(); settings = { ...settings, ...(restored.settings || {}) }; bookmarks = restored.bookmarks || []; history = restored.history || []; downloads = restored.downloads || []; savedSessions = restored.savedSessions || [];
  ses = session.fromPartition(PROFILE, { cache: true });
  installSiteCompatibility();
  installTrainingCapture();
  installBlocking();
  ses.on('will-download', (_, item) => { const entry = { id: crypto.randomUUID(), filename: item.getFilename(), url: item.getURL(), path: '', state: 'progressing', received: 0, total: item.getTotalBytes(), startedAt: Date.now() }; downloads.unshift(entry); send('downloads:changed', downloads); schedulePersist(); item.on('updated', (_event, state) => { entry.state = state; entry.received = item.getReceivedBytes(); send('downloads:changed', downloads); }); item.once('done', (_event, state) => { entry.state = state; entry.path = item.getSavePath(); entry.received = item.getReceivedBytes(); send('downloads:changed', downloads); schedulePersist(); }); });
  win = new BrowserWindow({ width: 1440, height: 920, minWidth: 940, minHeight: 640, backgroundColor: '#090d15', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 18 }, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  await win.loadFile(path.join(__dirname, 'ui', 'index.html')); win.on('resize', layout); win.on('close', persist); win.on('closed', () => { tabs.forEach(destroyView); tabs = []; activeId = null; panelOpen = false; win = null; });
  const restoredTabs = (restored.tabs || []).slice(0, 24); tabs = restoredTabs.length ? restoredTabs.map((tab) => ({ ...tab, view: null, attached: false })) : [];
  if (!tabs.length) await createTab(); else await activateTab(tabs.some(t => t.id === restored.activeId) ? restored.activeId : tabs[0].id);
  suspensionTimer = setInterval(suspendInactive, 30_000); emitState(true); warmRestoredTabs();
}

ipcMain.handle('app:get-state', () => buildState());
ipcMain.handle('tab:new', (_, url) => createTab(url || HOME)); ipcMain.handle('tab:activate', (_, id) => activateTab(id)); ipcMain.handle('tab:close', (_, id) => closeTab(id));
ipcMain.handle('browser:navigate', async (_, input) => { const tab = activeTab(); if (!tab) return; const url = cleanTarget(input); if (!tab.view) newView(tab); attachView(tab); await loadTab(tab, url); emitState(); });
ipcMain.handle('browser:back', () => { const webContents = activeWebContents(); if (webContents?.navigationHistory.canGoBack()) webContents.navigationHistory.goBack(); });
ipcMain.handle('browser:forward', () => { const webContents = activeWebContents(); if (webContents?.navigationHistory.canGoForward()) webContents.navigationHistory.goForward(); });
ipcMain.handle('browser:reload', () => activeWebContents()?.reload());
ipcMain.handle('browser:home', () => showNewTab(activeTab()));
ipcMain.handle('settings:set', (_, patch) => { settings = { ...settings, ...patch }; applyCleanWeb(); emitState(); schedulePersist(); return settings; });
ipcMain.handle('panel:set-open', (_, open) => { panelOpen = Boolean(open); layout(); });
ipcMain.handle('protection:get-details', () => blockedRequests.slice());
ipcMain.handle('training:get-stats', () => captureStore?.stats() || { enabled: false, sessionCaptured: 0, sessionRejected: 0, bytes: 0 });
ipcMain.handle('site:open-external', (_, target) => { try { const url = new URL(target); if (url.protocol === 'https:' && /(^|\.)magicbricks\.com$/i.test(url.hostname)) return shell.openExternal(url.toString()); } catch {} return false; });
ipcMain.handle('library:get', () => ({ history, bookmarks, downloads, savedSessions })); ipcMain.handle('history:clear', () => { history = []; schedulePersist(); return history; });
ipcMain.handle('bookmark:toggle', () => { const tab = activeTab(); if (!tab || tab.url === HOME) return bookmarks; const index = bookmarks.findIndex((b) => b.url === tab.url); if (index >= 0) bookmarks.splice(index, 1); else bookmarks.unshift({ id: crypto.randomUUID(), url: tab.url, title: tab.title, createdAt: Date.now() }); emitState(); schedulePersist(); return bookmarks; });
ipcMain.handle('session:save', (_, name) => { savedSessions.unshift({ id: crypto.randomUUID(), name: name || `Session ${savedSessions.length + 1}`, createdAt: Date.now(), tabs: tabs.map(({ url, title }) => ({ url, title })) }); schedulePersist(); return savedSessions; });
ipcMain.handle('session:restore', async (_, id) => { const snapshot = savedSessions.find(s => s.id === id); if (!snapshot) return; const added = []; for (const item of snapshot.tabs) added.push(await createTab(item.url, false)); if (added.length) await activateTab(added[0].id); }); ipcMain.handle('download:open', (_, filePath) => filePath && shell.openPath(filePath));
ipcMain.handle('ai:ask', async (_, { prompt, pageText }) => {
  if (!settings.aiEnabled) return { ok: false, error: 'AI Assistant is disabled.' };
  try {
    const weather = pageText ? { matched: false } : await getWeatherContext(prompt);
    if (weather.needsLocation) return { ok: true, text: 'Which city should I check? For example: “weather in Amsterdam”.' };
    if (weather.error) return { ok: true, text: weather.error };
    const context = weather.context || String(pageText || '').slice(0, 18_000);
    return { ok: true, text: await ai.ask({ prompt, context }) };
  } catch (error) { return { ok: false, error: error.message, hint: 'Browsing remains fully functional. For local AI errors, verify Ollama and the configured Qwen model.' }; }
});
ipcMain.handle('page:extract', async () => { const tab = activeTab(); if (!tab?.view) return ''; try { return await tab.view.webContents.executeJavaScript(`document.body?.innerText?.slice(0,18000)||''`, true); } catch { return ''; } });
ipcMain.handle('page:clean-ai', async () => {
  const webContents = activeWebContents(); if (!webContents) return { ok: false, error: 'Open a web page first.' };
  if (!settings.aiEnabled) return { ok: false, error: 'Local AI is disabled.' };
  try {
    const candidates = await webContents.executeJavaScript(`(() => { document.querySelectorAll('[data-clearweb-ai-candidate]').forEach((el)=>el.removeAttribute('data-clearweb-ai-candidate')); const selector='aside,iframe,[data-ad],[data-ad-slot],[aria-label],[id],[class]'; const items=[]; for(const el of document.querySelectorAll(selector)){ if(items.length>=60)break; if(el.closest('nav,form,[role="dialog"],[aria-modal="true"]'))continue; const text=Array.from(el.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').trim().slice(0,60); const signature=[el.id,el.className,el.getAttribute('aria-label'),text].filter(Boolean).join(' ').toLowerCase(); if(!/(^|[^a-z])(ad|ads|advert|sponsor|promo|banner|newsletter|commercial)([^a-z]|$)/i.test(signature)&&el.tagName!=='IFRAME')continue; const index=items.length; el.setAttribute('data-clearweb-ai-candidate',String(index)); items.push({index,tag:el.tagName,id:String(el.id||'').slice(0,60),className:String(el.className||'').slice(0,80),aria:String(el.getAttribute('aria-label')||'').slice(0,60),text}); } return items; })()`, true);
    if (!candidates.length) return { ok: true, removed: 0, text: 'The page already looks clean—no advertisement containers were found.' };
    const response = await ai.ask({ prompt: `Select only advertisement, sponsored, promotional, newsletter, or empty ad-placeholder elements. Return ONLY a JSON array of indexes. Keep navigation and article content. Candidates: ${JSON.stringify(candidates)}`, context: '', options: { temperature: 0, num_predict: 96 } });
    const match = String(response).match(/\[[\d\s,]*\]/); const selected = match ? JSON.parse(match[0]).filter(Number.isInteger) : [];
    const removed = await webContents.executeJavaScript(`(() => { const selected=new Set(${JSON.stringify(selected)}); let removed=0; document.querySelectorAll('[data-clearweb-ai-candidate]').forEach((el)=>{ const index=Number(el.getAttribute('data-clearweb-ai-candidate')); el.removeAttribute('data-clearweb-ai-candidate'); if(selected.has(index)&&el.isConnected){el.remove();removed++;} }); document.documentElement.style.setProperty('--clearweb-reflow-tick',Date.now()); return removed; })()`, true);
    return { ok: true, removed, text: removed ? `Cleaned ${removed} advertisement or placeholder element${removed === 1 ? '' : 's'} and reflowed the page.` : 'AI did not find any additional advertisement elements safe to remove.' };
  } catch (error) { return { ok: false, error: `AI cleanup failed: ${error.message}`, hint: 'The page was left unchanged.' }; }
});
app.whenReady().then(createBrowser); app.on('before-quit', () => { clearInterval(suspensionTimer); tabs.forEach(destroyView); persist(); }); app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); }); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createBrowser(); });
