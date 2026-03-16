#!/usr/bin/env node

import { getConfigPath } from './config.js';
import { createBridgeSupervisor } from './supervisor.js';

async function main() {
  const supervisor = createBridgeSupervisor();
  await supervisor.start();

  const snapshot = supervisor.getSnapshot();
  console.log('CDP bridge is running.');
  console.log(`Config: ${getConfigPath()}`);
  console.log(`Bridge status: http://127.0.0.1:${snapshot.bridgePort}/status`);
  console.log(`OpenClaw WS endpoint: ${snapshot.wsEndpoint ?? 'Unavailable'}`);
  console.log(`CDP version endpoint: ${snapshot.versionEndpoint ?? 'Unavailable'}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
