import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const tailscaleCandidates = [
  'tailscale',
  'C:/Program Files/Tailscale/tailscale.exe',
  `${process.env.LOCALAPPDATA || ''}/Tailscale/tailscale.exe`
].filter(Boolean);

async function runTailscale(args) {
  for (const executable of tailscaleCandidates) {
    try {
      return await execFileAsync(executable, args, { windowsHide: true });
    } catch {
    }
  }

  throw new Error('tailscale CLI unavailable');
}

function getPrivateIpv4Candidates() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const items of Object.values(interfaces)) {
    for (const item of items ?? []) {
      if (item.family === 'IPv4' && !item.internal) {
        addresses.push(item.address);
      }
    }
  }

  return addresses;
}

export async function getTailscaleIpv4() {
  try {
    const { stdout } = await runTailscale(['ip', '-4']);
    const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    return lines[0] ?? null;
  } catch {
    return getPrivateIpv4Candidates()[0] ?? null;
  }
}

export async function getTailscaleStatus() {
  try {
    const { stdout } = await runTailscale(['status', '--json']);
    const parsed = JSON.parse(stdout);
    return {
      installed: true,
      online: parsed.BackendState === 'Running',
      tailscaleIp: parsed.TailscaleIPs?.[0] ?? null,
      backendState: parsed.BackendState,
      tailnet: parsed.CurrentTailnet?.Name ?? null,
      hostname: parsed.Self?.HostName ?? os.hostname()
    };
  } catch {
    return {
      installed: false,
      online: false,
      tailscaleIp: getPrivateIpv4Candidates()[0] ?? null,
      backendState: 'Unavailable',
      tailnet: null,
      hostname: os.hostname()
    };
  }
}
