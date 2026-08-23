const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clearweb', {
  navigate: (value) => ipcRenderer.invoke('browser:navigate', value),
  back: () => ipcRenderer.invoke('browser:back'),
  forward: () => ipcRenderer.invoke('browser:forward'),
  reload: () => ipcRenderer.invoke('browser:reload'),
  home: () => ipcRenderer.invoke('browser:home'),
  getProtection: () => ipcRenderer.invoke('protection:get'),
  onState: (callback) => ipcRenderer.on('browser:state', (_, state) => callback(state)),
  onProtection: (callback) => ipcRenderer.on('protection:state', (_, state) => callback(state))
});
