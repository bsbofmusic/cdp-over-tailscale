import http from 'node:http';
import { URL } from 'node:url';

import { WebSocket, WebSocketServer } from 'ws';

import { getChromeVersion } from './chrome.js';
import { getTailscaleStatus } from './tailscale.js';

async function getBridgeMetadata(config) {
  const versionInfo = await getChromeVersion(config.chromeDebugPort);
  const tailscale = await getTailscaleStatus();
  const tailscaleIp = tailscale.tailscaleIp;
  const baseHost = tailscaleIp ?? '127.0.0.1';
  const wsUrl = `ws://${baseHost}:${config.bridgePort}/devtools/browser?token=${config.token}`;

  return {
    tailscale,
    tailscaleIp,
    wsUrl,
    versionInfo
  };
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
}

function isAuthorized(request, token) {
  const parsed = new URL(request.url, 'http://127.0.0.1');
  return parsed.searchParams.get('token') === token;
}

export async function startBridgeServer(config) {
  const server = http.createServer(async (request, response) => {
    const parsed = new URL(request.url, 'http://127.0.0.1');

    if (parsed.pathname === '/health') {
      return json(response, 200, { ok: true });
    }

    if (parsed.pathname === '/status') {
      try {
        const metadata = await getBridgeMetadata(config);
        return json(response, 200, {
          ok: true,
          bridgePort: config.bridgePort,
          chromeDebugPort: config.chromeDebugPort,
          tailscaleIp: metadata.tailscaleIp,
          tailscale: metadata.tailscale,
          wsEndpoint: metadata.wsUrl,
          browser: {
            browser: metadata.versionInfo.Browser,
            protocolVersion: metadata.versionInfo['Protocol-Version']
          }
        });
      } catch (error) {
        return json(response, 500, { ok: false, error: error.message });
      }
    }

    if (parsed.pathname === '/json/version') {
      if (!isAuthorized(request, config.token)) {
        return json(response, 401, { ok: false, error: 'Unauthorized' });
      }

      try {
        const metadata = await getBridgeMetadata(config);
        return json(response, 200, {
          ...metadata.versionInfo,
          webSocketDebuggerUrl: metadata.wsUrl
        });
      } catch (error) {
        return json(response, 500, { ok: false, error: error.message });
      }
    }

    return json(response, 404, { ok: false, error: 'Not found' });
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    const parsed = new URL(request.url, 'http://127.0.0.1');

    if (parsed.pathname !== '/devtools/browser' || !isAuthorized(request, config.token)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const versionInfo = await getChromeVersion(config.chromeDebugPort);
      const upstream = new WebSocket(versionInfo.webSocketDebuggerUrl);

      upstream.once('open', () => {
        wss.handleUpgrade(request, socket, head, (client) => {
          client.on('message', (message, isBinary) => {
            if (upstream.readyState === WebSocket.OPEN) {
              upstream.send(message, { binary: isBinary });
            }
          });

          upstream.on('message', (message, isBinary) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message, { binary: isBinary });
            }
          });

          const closeBoth = () => {
            if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
              client.close();
            }
            if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) {
              upstream.close();
            }
          };

          client.on('close', closeBoth);
          client.on('error', closeBoth);
          upstream.on('close', closeBoth);
          upstream.on('error', closeBoth);
        });
      });

      upstream.once('error', () => {
        socket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n');
        socket.destroy();
      });
    } catch {
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.bridgePort, config.bindHost ?? '0.0.0.0', resolve);
  });

  return {
    server,
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}
