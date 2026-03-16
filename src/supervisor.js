import { EventEmitter } from 'node:events';

import { createBridgeService } from './bridge-service.js';
import { getAppDir } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('supervisor');

function now() {
  return new Date().toISOString();
}

export function createBridgeSupervisor() {
  const service = createBridgeService();
  const events = new EventEmitter();
  let monitorTimer = null;
  let state = {
    phase: 'idle',
    running: false,
    repairCount: 0,
    lastError: null,
    lastHealthyAt: null,
    startedAt: null,
    appDir: getAppDir(),
    logDir: service.getConfig().logDir
  };

  function pushState(patch) {
    state = { ...state, ...patch };
    logger.info('state-updated', { phase: state.phase, running: state.running, lastError: state.lastError });
    events.emit('state', state);
    return state;
  }

  async function refresh(phase = state.phase) {
    const snapshot = await service.getStatus();
    return pushState({
      ...snapshot,
      phase,
      lastHealthyAt: snapshot.running && snapshot.chromeReachable ? now() : state.lastHealthyAt
    });
  }

  async function performRepair(reason) {
    logger.warn('repair-start', { reason });
    pushState({ phase: 'repairing', lastError: reason });
    try {
      await service.repair();
      logger.info('repair-success');
      return refresh('running');
    } catch (error) {
      logger.error('repair-failed', { error: error.message });
      return pushState({
        phase: 'error',
        repairCount: state.repairCount + 1,
        lastError: error.message
      });
    }
  }

  async function tick() {
    try {
      const snapshot = await service.getStatus();
      const nextState = pushState({
        ...snapshot,
        phase: snapshot.running ? 'running' : 'idle',
        lastHealthyAt: snapshot.running && snapshot.chromeReachable ? now() : state.lastHealthyAt,
        lastError: snapshot.tailscale.online ? null : 'Tailscale offline'
      });

      if (service.getConfig().autoRepair && (!snapshot.running || !snapshot.chromeReachable)) {
        await performRepair('Bridge unhealthy');
      }

      return nextState;
    } catch (error) {
      logger.error('tick-failed', { error: error.message });
      return pushState({ phase: 'error', lastError: error.message });
    }
  }

  function startMonitor() {
    clearInterval(monitorTimer);
    monitorTimer = setInterval(() => {
      void tick();
    }, service.getConfig().healthCheckIntervalMs);
  }

  return {
    events,
    async start() {
      logger.info('start-requested');
      pushState({ phase: 'starting', startedAt: state.startedAt ?? now(), lastError: null });
      const snapshot = await service.start();
      startMonitor();
      return pushState({ ...snapshot, phase: 'running', lastHealthyAt: now() });
    },
    async stop() {
      logger.info('stop-requested');
      clearInterval(monitorTimer);
      monitorTimer = null;
      await service.stop();
      return pushState({ phase: 'stopped', running: false });
    },
    async restart() {
      logger.info('restart-requested');
      pushState({ phase: 'restarting' });
      await service.restart();
      startMonitor();
      return refresh('running');
    },
    async repair() {
      return performRepair('Manual repair');
    },
    async rotateToken() {
      logger.info('token-rotate-requested');
      pushState({ phase: 'rotating-token' });
      await service.rotateToken();
      return refresh('running');
    },
    async refresh() {
      return refresh(state.phase === 'idle' ? 'idle' : 'running');
    },
    getSnapshot() {
      return state;
    },
    updateConfig(mutator) {
      const config = service.updateConfig(mutator);
      pushState({ launchOnLogin: config.launchOnLogin });
      return config;
    }
  };
}
