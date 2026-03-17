import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';

import { getAppDir } from './config.js';

const SCHEMA_VERSION = 4;
const METADATA_FILE = '.advanced-profile-state.json';

function exists(targetPath) {
  try {
    return fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function sanitizeName(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function readJson(filePath) {
  try {
    if (!exists(filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function getReplicaBaseDir() {
  return path.join(getAppDir(), 'advanced-profile-replicas');
}

function buildLayout(config) {
  const profileDirectory = config.advancedProfileDirectory || 'Default';
  const replicaRootDir = path.join(getReplicaBaseDir(), sanitizeName(profileDirectory));

  return {
    profileDirectory,
    replicaRootDir,
    replicaProfileDir: path.join(replicaRootDir, profileDirectory),
    metadataPath: path.join(replicaRootDir, METADATA_FILE),
  };
}

async function ensureDir(targetPath) {
  await fsp.mkdir(targetPath, { recursive: true });
}

async function writeMetadata(layout, payload) {
  await ensureDir(layout.replicaRootDir);
  await fsp.writeFile(layout.metadataPath, JSON.stringify(payload, null, 2));
}

export function createAdvancedProfileManager() {
  const jobs = new Map();

  function getProfileState(config) {
    const layout = buildLayout(config);
    const metadata = readJson(layout.metadataPath);
    if (!metadata) {
      return { status: 'missing' };
    }
    if (metadata.schemaVersion !== SCHEMA_VERSION) {
      return { status: 'stale', lastSyncCompletedAt: metadata.lastSyncCompletedAt ?? null };
    }
    return {
      status: metadata.ready ? 'ready' : 'error',
      lastSyncCompletedAt: metadata.lastSyncCompletedAt ?? null,
      lastError: metadata.lastError ?? null,
    };
  }

  function getLaunchContext(config) {
    const layout = buildLayout(config);
    const state = getProfileState(config);
    if (state.status !== 'ready') {
      return null;
    }
    return {
      profileDirectory: layout.profileDirectory,
      userDataDir: layout.replicaRootDir,
    };
  }

  async function bootstrapReplica(config, emitProgress) {
    const layout = buildLayout(config);

    emitProgress?.({ stage: 'preparing-replica', percent: 15, detail: layout.profileDirectory });
    await ensureDir(layout.replicaRootDir);
    await ensureDir(layout.replicaProfileDir);

    emitProgress?.({ stage: 'replica-ready', percent: 100, detail: layout.profileDirectory });
    await writeMetadata(layout, {
      schemaVersion: SCHEMA_VERSION,
      ready: true,
      mode: 'minimal-persistent-replica',
      profileDirectory: layout.profileDirectory,
      lastSyncCompletedAt: new Date().toISOString(),
      lastError: null,
    });

    return {
      profileDirectory: layout.profileDirectory,
      userDataDir: layout.replicaRootDir,
    };
  }

  function ensureReplica(config, emitProgress) {
    const profileKey = config.advancedProfileDirectory || 'Default';
    if (jobs.has(profileKey)) {
      return jobs.get(profileKey);
    }

    const state = getProfileState(config);
    if (state.status === 'ready') {
      return Promise.resolve(getLaunchContext(config));
    }

    const job = bootstrapReplica(config, emitProgress).finally(() => {
      jobs.delete(profileKey);
    });
    jobs.set(profileKey, job);
    return job;
  }

  return {
    getProfileState,
    getLaunchContext,
    ensureReplica,
    invalidateReplica(config) {
      const layout = buildLayout(config);
      try {
        fs.rmSync(layout.replicaRootDir, { recursive: true, force: true });
      } catch {
      }
    },
  };
}
