const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld('clearweb', {
  getState: () => invoke('app:get-state'), onState: (callback) => ipcRenderer.on('app:state', (_, state) => callback(state)),
  newTab: (url) => invoke('tab:new', url), activateTab: (id) => invoke('tab:activate', id), closeTab: (id) => invoke('tab:close', id),
  navigate: (value) => invoke('browser:navigate', value), back: () => invoke('browser:back'), forward: () => invoke('browser:forward'), reload: () => invoke('browser:reload'), home: () => invoke('browser:home'),
  setSettings: (patch) => invoke('settings:set', patch), getLibrary: () => invoke('library:get'), clearHistory: () => invoke('history:clear'), toggleBookmark: () => invoke('bookmark:toggle'),
  saveSession: (name) => invoke('session:save', name), restoreSession: (id) => invoke('session:restore', id), openDownload: (path) => invoke('download:open', path), onDownloads: (callback) => ipcRenderer.on('downloads:changed', (_, items) => callback(items)),
  extractPage: () => invoke('page:extract'), askAI: (payload) => invoke('ai:ask', payload)
});
