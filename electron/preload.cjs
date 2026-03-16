const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridgeApp', {
  invoke(channel, payload) {
    return ipcRenderer.invoke(channel, payload);
  },
  onState(listener) {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on('bridge-state', handler);
    return () => ipcRenderer.off('bridge-state', handler);
  }
});
