import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const browserCandidates = [
  {
    name: 'Google Chrome',
    paths: [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`
    ]
  },
  {
    name: 'Microsoft Edge',
    paths: [
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      `${process.env.LOCALAPPDATA || ''}/Microsoft/Edge/Application/msedge.exe`
    ]
  },
  {
    name: 'Chromium',
    paths: [
      'C:/Program Files/Chromium/Application/chrome.exe',
      `${process.env.LOCALAPPDATA || ''}/Chromium/Application/chrome.exe`
    ]
  }
].map((browser) => ({
  ...browser,
  paths: browser.paths.filter(Boolean)
}));

function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function resolveChromePath(configuredPath) {
  if (configuredPath && exists(configuredPath)) {
    return configuredPath;
  }

  for (const browser of browserCandidates) {
    const match = browser.paths.find(exists);
    if (match) {
      return match;
    }
  }

  return null;
}

export function detectInstalledBrowsers() {
  return browserCandidates
    .map((browser) => {
      const executablePath = browser.paths.find(exists) ?? null;
      return executablePath ? { name: browser.name, executablePath } : null;
    })
    .filter(Boolean);
}

export function detectPreferredBrowser(configuredPath) {
  if (configuredPath && exists(configuredPath)) {
    return {
      name: 'Custom Browser',
      executablePath: configuredPath
    };
  }

  return detectInstalledBrowsers()[0] ?? null;
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unexpected ${response.status} from ${url}`);
  }
  return response.json();
}

export async function getChromeVersion(debugPort) {
  return readJson(`http://127.0.0.1:${debugPort}/json/version`);
}

export async function isChromeReachable(debugPort) {
  try {
    await getChromeVersion(debugPort);
    return true;
  } catch {
    return false;
  }
}

export async function killManagedBrowsers() {
  try {
    await execFileAsync('taskkill', ['/F', '/IM', 'chrome.exe'], { windowsHide: true });
  } catch {
  }

  try {
    await execFileAsync('taskkill', ['/F', '/IM', 'msedge.exe'], { windowsHide: true });
  } catch {
  }
}

export async function waitForChrome(debugPort, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await getChromeVersion(debugPort);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error('Chrome remote debugging endpoint did not become ready in time.');
}

export async function ensureChrome(config) {
  try {
    return await getChromeVersion(config.chromeDebugPort);
  } catch {
    if (!config.launchChrome) {
      throw new Error('Chrome is not running with remote debugging enabled.');
    }
  }

  const browser = detectPreferredBrowser(config.chromePath);
  if (!browser) {
    throw new Error('Chrome executable not found. Set chromePath in config.json.');
  }

  const args = [
    `--remote-debugging-port=${config.chromeDebugPort}`,
    `--user-data-dir=${config.chromeUserDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ];

  const child = spawn(browser.executablePath, args, {
    detached: true,
    stdio: 'ignore'
  });

  child.unref();

  return waitForChrome(config.chromeDebugPort);
}
