# cdp-over-tailscale

> Run Chrome on your Windows machine. Control it from anywhere — privately, over Tailscale.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2B-blue.svg)](#)
[![Electron](https://img.shields.io/badge/Electron-35.x-47848f.svg)](https://www.electronjs.org/)
[![Version](https://img.shields.io/badge/Version-0.2.1-green.svg)](./docs/RELEASE_NOTES_0_2_1.md)

---

- [English](#english)
- [中文](#中文)

---

## English

### What it does

AI agents need a real browser. This tool gives them one.

`cdp-over-tailscale` is a Windows tray app that wraps your local Chrome in a token-authenticated CDP bridge, exposed exclusively over your Tailscale private network. No port forwarding. No public exposure. Your agent calls an API, the browser starts, and a WebSocket endpoint is ready to connect.

Think of it as a Tailscale plugin for browser automation.

### How it works

```
Remote Agent (anywhere on your Tailscale network)
    │
    ├─ POST /control/start   ← start the browser remotely
    ├─ GET  /json/version    ← check bridge status
    └─ WS   /devtools/browser ← connect and control
          │
          ▼
    CDP Bridge (Windows tray app)
          │
          ▼
    Local Chrome / Edge / Chromium
```

### Requirements

- Windows 10 or later
- [Tailscale](https://tailscale.com) installed and signed in
- Chrome, Edge, or any Chromium-based browser

### Quick Start

1. Install Tailscale and connect to your network.
2. Download and install `CDP Bridge` from [Releases](../../releases).
3. Launch it — it lives in the system tray.
4. Set your bridge port and token in the settings.
5. Click **Start CDP**, or let your agent call `/control/start`.

**Check the bridge:**

```bash
curl -s "http://<tailscale-ip>:<port>/json/version?token=<token>" --connect-timeout 5
```

**Start the browser remotely:**

```bash
# Clean isolated session
curl -X POST "http://<tailscale-ip>:<port>/control/start?token=<token>&mode=clean"

# Persistent replica with a specific Chrome profile
curl -X POST "http://<tailscale-ip>:<port>/control/start?token=<token>&mode=advanced&profile=Default"
```

**Then connect your agent to the WebSocket endpoint.**

### Modes

#### Clean Mode

Starts Chrome with a fresh isolated profile every time. No login state, no extensions carried over. Best for stateless automation and short-lived tasks.

#### Advanced Mode

Creates a persistent browser replica that you sign into once and reuse indefinitely. Bookmarks, extensions, and history sync naturally. Best for building a long-lived "agent browser" that stays warmed up.

> First-time sign-in to high-security sites (e.g. Gmail) may still require verification — that is expected. The key is to keep reusing the same replica rather than resetting it.

### Agent Integration

The tray app provides ready-to-use integration helpers:

- **Copy Generic Agent Prompt** — a complete prompt with bridge address, startup logic, mode selection, and WS connection rules. Paste directly into your agent.
- **Copy Playwright Snippet** — ready-to-run Playwright code targeting the bridge.
- **Copy Developer CDP URL** — raw endpoint for manual use or debugging.

### Developer Area

| Action | Effect |
|--------|--------|
| Copy Playwright Snippet | Playwright code for the current bridge |
| Copy Developer CDP URL | Raw CDP WebSocket URL |
| Reset Advanced Replica | Deletes the current replica; next launch creates a fresh one |

### Local Development

```bash
npm install     # install dependencies
npm start       # run locally
npm run check   # syntax check
npm run dist:win  # build Windows installer → dist/CDP Bridge-Setup-0.2.1.exe
```

### Clean Reinstall

If the app behaves unexpectedly or a previous install left stale state, use the **Clean reinstall** option in the installer. It removes old processes, runtime data, and shortcuts before reinstalling.

---

## 中文

### 它是什么

`cdp-over-tailscale` 是一个 Windows 托盘应用，把你本地的 Chrome 包装成一个通过 Tailscale 私网访问的 CDP Bridge。

可以把它理解成 **Tailscale 的浏览器自动化插件**：远端 Agent 通过 API 拉起浏览器，连接 WebSocket，像坐在你电脑前一样操控页面。全程走 Tailscale 私网，不暴露公网端口，不需要改防火墙。

### 工作方式

```
远端 Agent（Tailscale 网络内任意位置）
    │
    ├─ POST /control/start   ← 远程拉起浏览器
    ├─ GET  /json/version    ← 检查 bridge 状态
    └─ WS   /devtools/browser ← 连接并控制
          │
          ▼
    CDP Bridge（Windows 托盘应用）
          │
          ▼
    本地 Chrome / Edge / Chromium
```

### 环境要求

- Windows 10 及以上
- 已安装并登录 [Tailscale](https://tailscale.com)
- Chrome、Edge 或任意 Chromium 内核浏览器

### 快速开始

1. 安装 Tailscale 并连接到你的网络。
2. 从 [Releases](../../releases) 下载并安装 `CDP Bridge`。
3. 启动后常驻托盘。
4. 在设置中配置 bridge 端口和 token。
5. 点击 **一键启动**，或让远端 Agent 调用 `/control/start`。

**检查 bridge 状态：**

```bash
curl -s "http://<tailscale-ip>:<端口>/json/version?token=<token>" --connect-timeout 5
```

**远程拉起浏览器：**

```bash
# 干净模式（隔离 profile）
curl -X POST "http://<tailscale-ip>:<端口>/control/start?token=<token>&mode=clean"

# 高级模式（持久副本，指定 Chrome 用户）
curl -X POST "http://<tailscale-ip>:<端口>/control/start?token=<token>&mode=advanced&profile=Default"
```

### 模式说明

#### 干净模式

每次使用独立隔离的 profile 启动，不继承登录态和扩展。适合无状态自动化和临时任务。

#### 高级模式

创建一个持久化的浏览器副本，登录一次后长期复用。书签、扩展、历史自然同步。适合养一个专属的"Agent 浏览器"。

> 首次登录高风控站点（如 Gmail）可能仍需验证身份，这是正常现象。关键是持续复用同一个副本，而不是反复重置。

### Agent 接入

托盘应用提供三种接入方式：

- **复制通用 Agent Prompt** — 包含 bridge 地址、远程启动逻辑、模式选择和 WS 连接规则，直接粘贴给 Agent 使用。
- **复制 Playwright 代码** — 可直接运行的 Playwright 代码片段。
- **复制开发者 CDP 地址** — 原始 WebSocket 地址，用于手动调试。

### 本地开发

```bash
npm install       # 安装依赖
npm start         # 本地运行
npm run check     # 语法检查
npm run dist:win  # 打包 Windows 安装器 → dist/CDP Bridge-Setup-0.2.1.exe
```

### 清洁重装

如果安装版行为异常或旧版本残留，使用安装器中的 **Clean reinstall** 选项，它会清理旧进程、旧数据和快捷方式后重新安装。

---

## License

MIT
