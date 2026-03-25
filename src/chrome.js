import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
let managedBrowserPid = null;
const browserRuntimeState = {
  lastLaunchAt: null,
  lastLaunchMode: null,
  lastLaunchBrowser: null,
  lastLaunchArgs: [],
  lastLaunchError: null,
  lastLaunchErrorCode: null,
  lastLaunchDurationMs: null,
  lastCdpReadyAt: null,
  lastProbeAt: null,
  lastProbeError: null,
  lastProbeErrorCode: null,
  lastProbeDurationMs: null,
  managedBrowserPid: null,
};

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

const desktopViewportArgs = [
  '--window-size=1366,768',
  '--window-size=1440,900',
  '--window-size=1536,864',
  '--window-size=1600,900',
  '--window-size=1728,1117',
  '--window-size=1920,1080',
];

const mobileViewportArgs = [
  '--window-size=390,844',
  '--window-size=412,915',
  '--window-size=430,932',
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function exists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function readJsonFile(filePath) {
  try {
    if (!exists(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function now() {
  return new Date().toISOString();
}

function normalizePathForMatch(value) {
  return String(value || '').replace(/\\/g, '/').toLowerCase();
}

function classifyChromeError(error) {
  const message = error?.message || 'Unknown Chrome error';
  const lower = message.toLowerCase();

  if (lower.includes('did not become ready in time')) {
    return { code: 'cdp-timeout', message };
  }
  if (lower.includes('fetch failed')) {
    return { code: 'cdp-unreachable', message };
  }
  if (lower.includes('unexpected 404')) {
    return { code: 'cdp-endpoint-missing', message };
  }
  if (lower.includes('unexpected 403') || lower.includes('unexpected 401')) {
    return { code: 'cdp-denied', message };
  }
  if (lower.includes('chrome executable not found')) {
    return { code: 'browser-not-found', message };
  }
  if (lower.includes('advanced mode browser data is still being prepared')) {
    return { code: 'advanced-replica-pending', message };
  }
  if (lower.includes('advanced mode could not launch')) {
    return { code: 'advanced-launch-failed', message };
  }
  if (lower.includes('remote debugging enabled')) {
    return { code: 'cdp-disabled', message };
  }

  return { code: 'chrome-error', message };
}

function markProbeSuccess(durationMs) {
  browserRuntimeState.lastProbeAt = now();
  browserRuntimeState.lastProbeError = null;
  browserRuntimeState.lastProbeErrorCode = null;
  browserRuntimeState.lastProbeDurationMs = durationMs;
  browserRuntimeState.lastCdpReadyAt = browserRuntimeState.lastProbeAt;
}

function markProbeFailure(error, durationMs) {
  const classified = classifyChromeError(error);
  browserRuntimeState.lastProbeAt = now();
  browserRuntimeState.lastProbeError = classified.message;
  browserRuntimeState.lastProbeErrorCode = classified.code;
  browserRuntimeState.lastProbeDurationMs = durationMs;
}

function markLaunchFailure(error, durationMs = null) {
  const classified = classifyChromeError(error);
  browserRuntimeState.lastLaunchError = classified.message;
  browserRuntimeState.lastLaunchErrorCode = classified.code;
  browserRuntimeState.lastLaunchDurationMs = durationMs;
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

export function detectChromeProfiles(userDataDir) {
  const rootDir = userDataDir || path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
  if (!exists(rootDir)) {
    return [];
  }

  const localState = readJsonFile(path.join(rootDir, 'Local State'));
  const infoCache = localState?.profile?.info_cache ?? {};
  const directories = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name === 'Default' || /^Profile \d+$/.test(name));

  return directories.map((directory) => {
    const cacheEntry = infoCache[directory] ?? {};
    const displayName = cacheEntry.name || cacheEntry.shortcut_name || directory;
    return {
      id: directory,
      directory,
      name: displayName,
      label: `${displayName} (${directory})`,
      path: path.join(rootDir, directory)
    };
  });
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unexpected ${response.status} from ${url}`);
  }
  return response.json();
}

export async function getChromeVersion(debugPort) {
  const startedAt = Date.now();
  try {
    const result = await readJson(`http://127.0.0.1:${debugPort}/json/version`);
    markProbeSuccess(Date.now() - startedAt);
    return result;
  } catch (error) {
    markProbeFailure(error, Date.now() - startedAt);
    throw error;
  }
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
  if (!managedBrowserPid) {
    return;
  }

  try {
    await execFileAsync('taskkill', ['/F', '/T', '/PID', String(managedBrowserPid)], { windowsHide: true });
  } catch {
  } finally {
    managedBrowserPid = null;
  }
}

async function killProcessTree(pid) {
  try {
    await execFileAsync('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true });
  } catch {
  }
}

async function findManagedBrowserPids(config) {
  const portMarker = `--remote-debugging-port=${config.chromeDebugPort}`;
  const managedMarkers = [
    config.chromeUserDataDir,
    config.advancedReplicaRootDir,
  ]
    .map(normalizePathForMatch)
    .filter(Boolean);

  const script = [
    `$portMarker = '${String(portMarker).replace(/'/g, "''")}'`,
    "$managedMarkers = @(",
    ...managedMarkers.map((marker) => `  '${String(marker).replace(/'/g, "''")}'`),
    ")",
    "Get-CimInstance Win32_Process | Where-Object {",
    "  $cmd = $_.CommandLine",
    "  if (-not $cmd) { return $false }",
    "  $normalized = $cmd.Replace('\\', '/').ToLowerInvariant()",
    "  $hasPort = $normalized.Contains($portMarker.ToLowerInvariant())",
    "  $hasManagedMarker = $managedMarkers.Count -eq 0 -or (($managedMarkers | Where-Object { $normalized.Contains($_) }).Count -gt 0)",
    "  $hasPort -and $hasManagedMarker",
    "} | Select-Object -ExpandProperty ProcessId"
  ].join('; ');

  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true });
    return stdout
      .split(/\r?\n/)
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

export async function stopManagedBrowsers(config) {
  const pids = new Set();

  if (managedBrowserPid) {
    pids.add(managedBrowserPid);
  }

  for (const pid of await findManagedBrowserPids(config)) {
    pids.add(pid);
  }

  for (const pid of pids) {
    await killProcessTree(pid);
  }

  managedBrowserPid = null;
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

export async function ensureChrome(config, advancedLaunchContext, onProgress) {
  try {
    return await getChromeVersion(config.chromeDebugPort);
  } catch {
    if (!config.launchChrome) {
      const error = new Error('Chrome is not running with remote debugging enabled.');
      markLaunchFailure(error);
      throw error;
    }
  }

  const browser = detectPreferredBrowser(config.chromePath);
  if (!browser) {
    const error = new Error('Chrome executable not found. Set chromePath in config.json.');
    markLaunchFailure(error);
    throw error;
  }

  if (config.browserMode === 'advanced' && !advancedLaunchContext) {
    const error = new Error('Advanced Mode browser data is still being prepared.');
    markLaunchFailure(error);
    throw error;
  }

  onProgress?.({ stage: 'preparing-browser', percent: 10, detail: browser.name });

  const profileRootDir = advancedLaunchContext?.userDataDir ?? config.chromeUserDataDir;
  const profileDirectory = advancedLaunchContext?.profileDirectory ?? config.advancedProfileDirectory ?? 'Default';
  const viewportArg = config.deviceMode === 'mobile'
    ? pickRandom(mobileViewportArgs)
    : pickRandom(desktopViewportArgs);

  const args = [
    `--remote-debugging-port=${config.chromeDebugPort}`,
    `--user-data-dir=${profileRootDir}`,
    viewportArg,
    '--lang=zh-CN',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ];

  if (config.browserMode === 'advanced') {
    args.splice(2, 0, `--profile-directory=${profileDirectory}`);
  }

  browserRuntimeState.lastLaunchAt = now();
  browserRuntimeState.lastLaunchMode = config.browserMode === 'advanced' ? 'advanced' : 'clean';
  browserRuntimeState.lastLaunchBrowser = browser.name;
  browserRuntimeState.lastLaunchArgs = [...args];
  browserRuntimeState.lastLaunchError = null;
  browserRuntimeState.lastLaunchErrorCode = null;
  browserRuntimeState.lastLaunchDurationMs = null;

  const launchStartedAt = Date.now();

  onProgress?.({ stage: 'launching-browser', percent: 88, detail: config.browserMode === 'advanced' ? profileDirectory : 'clean' });

  const child = spawn(browser.executablePath, args, {
    detached: true,
    stdio: 'ignore'
  });

  managedBrowserPid = child.pid ?? null;
  browserRuntimeState.managedBrowserPid = managedBrowserPid;
  child.unref();

  try {
    onProgress?.({ stage: 'waiting-cdp', percent: 96, detail: String(config.chromeDebugPort) });
    const versionInfo = await waitForChrome(config.chromeDebugPort, config.browserMode === 'advanced' ? 30000 : 15000);
    browserRuntimeState.lastLaunchDurationMs = Date.now() - launchStartedAt;
    browserRuntimeState.lastLaunchError = null;
    browserRuntimeState.lastLaunchErrorCode = null;
    return versionInfo;
  } catch (error) {
    managedBrowserPid = null;
    browserRuntimeState.managedBrowserPid = null;
    markLaunchFailure(error, Date.now() - launchStartedAt);
    if (config.browserMode === 'advanced') {
      throw new Error('Advanced Mode could not launch the managed browser replica.');
    }
    throw error;
  }
}

export function getBrowserRuntimeState() {
  return {
    ...browserRuntimeState,
    managedBrowserPid,
  };
}

export function getBrowserModeMeta(config, advancedLaunchContext = null) {
  const browserMode = config.browserMode === 'advanced' ? 'advanced' : 'clean';
  const deviceMode = config.deviceMode === 'mobile' ? 'mobile' : 'desktop';
  const viewport = deviceMode === 'mobile'
    ? { width: 1080, height: 1920, label: '1080x1920' }
    : { width: 1920, height: 1080, label: '1920x1080' };
  const profileDir = browserMode === 'advanced'
    ? path.join(advancedLaunchContext?.userDataDir ?? config.chromeUserDataDir, advancedLaunchContext?.profileDirectory ?? config.advancedProfileDirectory ?? 'Default')
    : config.chromeUserDataDir;

  return {
    browserMode,
    deviceMode,
    viewport,
    profileDir,
    browserModeLabel: browserMode === 'advanced' ? 'Advanced Mode' : 'Clean Mode',
    deviceModeLabel: deviceMode === 'mobile' ? 'Mobile Mode' : 'Desktop Mode'
  };
}
