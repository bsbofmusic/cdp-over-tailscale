import fs from 'node:fs';
import path from 'node:path';

import { loadConfig } from './config.js';

function ensureLogDir(logDir) {
  fs.mkdirSync(logDir, { recursive: true });
}

function getLogFilePath(logDir) {
  const stamp = new Date().toISOString().slice(0, 10);
  return path.join(logDir, `${stamp}.log`);
}

export function createLogger(scope) {
  return {
    write(level, message, extra = {}) {
      const { logDir } = loadConfig();
      ensureLogDir(logDir);
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        level,
        scope,
        message,
        ...extra
      });
      fs.appendFileSync(getLogFilePath(logDir), `${line}\n`);
    },
    info(message, extra) {
      this.write('info', message, extra);
    },
    warn(message, extra) {
      this.write('warn', message, extra);
    },
    error(message, extra) {
      this.write('error', message, extra);
    }
  };
}
