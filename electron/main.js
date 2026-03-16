import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, clipboard, ipcMain, Menu, nativeImage, Notification, shell, Tray } from 'electron';

import { getConfigPath } from '../src/config.js';
import { createBridgeSupervisor } from '../src/supervisor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDevBuild = !app.isPackaged;

if (isDevBuild) {
  app.setPath('userData', path.join(app.getPath('appData'), 'cdp-bridge-dev'));
}

const supervisor = createBridgeSupervisor();

let tray = null;
let mainWindow = null;

function createTrayIcon(status) {
  const palette = {
    running: '#22c55e',
    starting: '#3b82f6',
    restarting: '#3b82f6',
    repairing: '#ef4444',
    error: '#ef4444',
    stopped: '#64748b',
    idle: '#64748b',
    'rotating-token': '#8b5cf6'
  };
  const color = palette[status] ?? '#64748b';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="${color}" /><circle cx="32" cy="32" r="12" fill="#0f172a" /></svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function showNotification(body) {
  new Notification({ title: 'CDP Bridge', body }).show();
}

function showWindow() {
  if (!mainWindow) {
    return;
  }
  mainWindow.show();
  mainWindow.focus();
}

function updateLaunchOnLogin(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath
  });
}

async function copyEndpoint(type) {
  const snapshot = supervisor.getSnapshot();
  const value = type === 'ws' ? snapshot.wsEndpoint : snapshot.versionEndpoint;
  if (!value) {
    return;
  }
  clipboard.writeText(value);
  showNotification(`${type === 'ws' ? 'WS' : 'HTTP'} endpoint copied.`);
}

function buildTrayMenu(snapshot) {
  return Menu.buildFromTemplate([
    { label: `Status: ${snapshot.phase}`, enabled: false },
    { label: snapshot.wsEndpoint ?? 'WS endpoint unavailable', click: () => void copyEndpoint('ws'), enabled: Boolean(snapshot.wsEndpoint) },
    { label: snapshot.versionEndpoint ?? 'HTTP endpoint unavailable', click: () => void copyEndpoint('http'), enabled: Boolean(snapshot.versionEndpoint) },
    { type: 'separator' },
    { label: 'Open status window', click: showWindow },
    { label: 'One-click bridge', click: () => void supervisor.restart() },
    { label: 'One-click repair', click: () => void supervisor.repair() },
    { label: 'Rotate token', click: () => void supervisor.rotateToken() },
    { label: 'Open config file', click: () => void shell.showItemInFolder(getConfigPath()) },
    { label: 'Open logs folder', click: () => void shell.openPath(snapshot.logDir ?? snapshot.appDir) },
    { type: 'separator' },
    {
      label: 'Launch on login',
      type: 'checkbox',
      checked: Boolean(snapshot.launchOnLogin),
      click: ({ checked }) => {
        supervisor.updateConfig((config) => ({ ...config, launchOnLogin: checked }));
        updateLaunchOnLogin(checked);
        void supervisor.refresh();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        void supervisor.stop().finally(() => app.quit());
      }
    }
  ]);
}

function syncUi(snapshot) {
  if (!tray) {
    return;
  }

  tray.setImage(createTrayIcon(snapshot.phase));
  tray.setToolTip(`${isDevBuild ? 'CDP Bridge Dev' : 'CDP Bridge'} · ${snapshot.phase}${snapshot.tailscale?.tailscaleIp ? ` · ${snapshot.tailscale.tailscaleIp}` : ''}`);
  tray.setContextMenu(buildTrayMenu(snapshot));
  mainWindow?.webContents.send('bridge-state', snapshot);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 580,
    minWidth: 720,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  void mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function wireIpc() {
  ipcMain.handle('bridge:get-state', async () => supervisor.refresh());
  ipcMain.handle('bridge:restart', async () => supervisor.restart());
  ipcMain.handle('bridge:repair', async () => supervisor.repair());
  ipcMain.handle('bridge:rotate-token', async () => supervisor.rotateToken());
  ipcMain.handle('bridge:copy', async (_event, payload) => copyEndpoint(payload.type));
  ipcMain.handle('bridge:set-launch-on-login', async (_event, payload) => {
    supervisor.updateConfig((config) => ({ ...config, launchOnLogin: payload.enabled }));
    updateLaunchOnLogin(payload.enabled);
    return supervisor.refresh();
  });
}

async function bootstrap() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    showWindow();
  });

  await app.whenReady();
  createWindow();
  wireIpc();

  tray = new Tray(createTrayIcon('starting'));
  tray.on('click', showWindow);
  supervisor.events.on('state', syncUi);

  try {
    const snapshot = await supervisor.start();
    updateLaunchOnLogin(Boolean(snapshot.launchOnLogin));
    syncUi(snapshot);
  } catch (error) {
    const snapshot = supervisor.getSnapshot();
    syncUi({ ...snapshot, phase: 'error', lastError: error.message });
    showNotification(error.message);
  }
}

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});

void bootstrap();
