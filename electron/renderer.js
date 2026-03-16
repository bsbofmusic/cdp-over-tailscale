const statusRoot = document.getElementById('status');
const actionsRoot = document.getElementById('actions');
const diagnosticsRoot = document.getElementById('diagnostics');
const feedbackRoot = document.getElementById('feedback');

function setFeedback(message, type = 'info') {
  feedbackRoot.textContent = message;
  feedbackRoot.dataset.state = type;
}

function render(state) {
  setFeedback(state.lastError ? `状态已更新：${state.lastError}` : '桥接服务已连接。');
  statusRoot.innerHTML = `
    <div class="status-pill status-${state.phase}">${state.phase}</div>
    <div class="status-grid">
      <div><strong>Browser</strong><span>${state.browserName ?? 'Not detected'}</span></div>
      <div><strong>Tailscale</strong><span>${state.tailscale?.online ? state.tailscale.tailscaleIp : 'Offline'}</span></div>
      <div><strong>Chrome CDP</strong><span>${state.chromeReachable ? 'Ready' : 'Unavailable'}</span></div>
      <div><strong>Repairs</strong><span>${state.repairCount ?? 0}</span></div>
    </div>
  `;

  actionsRoot.innerHTML = `
    <button data-action="copy-ws">Copy WS endpoint</button>
    <button data-action="copy-http">Copy HTTP endpoint</button>
    <button data-action="repair">One-click repair</button>
    <button data-action="restart">Restart bridge</button>
    <button data-action="rotate-token">Rotate token</button>
    <button data-action="refresh">Refresh status</button>
  `;

  diagnosticsRoot.innerHTML = `
    <div><strong>WS</strong><span>${state.wsEndpoint ?? 'Unavailable'}</span></div>
    <div><strong>HTTP</strong><span>${state.versionEndpoint ?? 'Unavailable'}</span></div>
    <div><strong>Config</strong><span>${state.appDir}</span></div>
    <div><strong>Logs</strong><span>${state.logDir}</span></div>
    <div><strong>Last error</strong><span>${state.lastError ?? 'None'}</span></div>
  `;

  document.querySelector('[data-setting="launchOnLogin"]').checked = Boolean(state.launchOnLogin);
}

async function boot() {
  if (!window.bridgeApp) {
    setFeedback('桌面桥接 API 未注入，preload 可能加载失败。', 'error');
    return;
  }

  try {
    const state = await window.bridgeApp.invoke('bridge:get-state');
    render(state);
    window.bridgeApp.onState((nextState) => {
      render(nextState);
    });
  } catch (error) {
    setFeedback(`读取桥接状态失败：${error.message}`, 'error');
  }
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (action === 'copy-ws') {
    await window.bridgeApp.invoke('bridge:copy', { type: 'ws' });
  }
  if (action === 'copy-http') {
    await window.bridgeApp.invoke('bridge:copy', { type: 'http' });
  }
  if (action === 'repair') {
    await window.bridgeApp.invoke('bridge:repair');
  }
  if (action === 'restart') {
    await window.bridgeApp.invoke('bridge:restart');
  }
  if (action === 'rotate-token') {
    await window.bridgeApp.invoke('bridge:rotate-token');
  }
  if (action === 'refresh') {
    await window.bridgeApp.invoke('bridge:get-state');
    setFeedback('已请求刷新状态。');
  }
  setFeedback('操作已发送，等待状态更新…');
});

document.addEventListener('change', async (event) => {
  const checkbox = event.target.closest('[data-setting="launchOnLogin"]');
  if (!checkbox) {
    return;
  }

  await window.bridgeApp.invoke('bridge:set-launch-on-login', {
    enabled: checkbox.checked
  });
  setFeedback(checkbox.checked ? '已开启开机启动。' : '已关闭开机启动。');
});

void boot();
