# 🌉 Tailscale CDP Bridge for Agents

**A Windows tray app that lets remote agents start and use your local browser through a Tailscale-secured CDP bridge.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE) [![Platform](https://img.shields.io/badge/Platform-Windows%2010%2B-blue.svg)](#) [![Electron](https://img.shields.io/badge/Electron-35.x-47848f.svg)](https://www.electronjs.org/) [![Version](https://img.shields.io/badge/Version-0.2.1-green.svg)](./docs/RELEASE_NOTES_0_2_1.md)

*Remote browser startup · Tailscale private access · Clean mode · Advanced replica mode · Agent-friendly CDP handoff*

---

- [中文](#中文)
- [English](#english)

---

## 中文

### 它解决什么问题

> “我想让远端 Agent 直接使用我这台 Windows 电脑上的浏览器。”  
> “我不想暴露原始 9222，也不想改一堆防火墙和 Chrome 调试参数。”  
> “我想要干净模式，也想要一个可以长期复用的高级副本模式。”

这个项目把本地浏览器包装成一个**可控、可远程拉起、可通过 Tailscale 私有访问**的 CDP Bridge。

简单说，它能把你这台 Windows 电脑上的浏览器安全地“借给”远程 AI 使用，让 OpenClaw、OpenCode、Codex 这类 Agent 像坐在你电脑前一样打开网页、读取页面并执行操作。

维护者：`bsbofmusic`

### 核心特性

- Windows 托盘常驻，随时可拉起本地浏览器
- 通过 Tailscale 暴露私有 bridge 地址，不暴露原始 `9222`
- 支持 `干净模式` 与 `高级模式`
- 支持远端 Agent 自主调用 `/control/start` 拉起浏览器
- 支持通用 Agent Prompt、Playwright 代码片段、开发者 CDP 地址复制
- 支持 `重置高级模式副本`
- 支持清洁重装与安装版恢复

### 模式说明

#### `干净模式`

- 使用隔离的独立 profile
- 启动快，稳定优先
- 不继承原生浏览器登录态和扩展
- 适合自动化、调试、临时任务

#### `高级模式`

- 创建一个**独立且可持久复用**的浏览器副本
- 默认不再重度复制原生浏览器数据
- 更适合在副本里自行登录账号，然后让浏览器自己同步书签、扩展、历史等资料
- 适合长期养熟一个“Agent 专用副本”

### 工作方式

```
Remote Agent
    │
    ├── Tailscale private network
    │
    └── CDP Bridge (Windows tray app)
          │
          ├── /control/start?mode=clean
          ├── /control/start?mode=advanced&profile=Default
          ├── /json/version?token=...
          └── /devtools/browser?token=...
                │
                ▼
             Local Chrome / Edge / Chromium
```

### 快速开始

#### 1. 安装与启动

1. 在本机安装并登录 Tailscale。
2. 安装 `CDP Bridge`。
3. 启动软件，让它常驻托盘。
4. 在界面中选择：
   - 浏览器模式
   - 页面模式
   - 高级模式下的 Chrome 用户
5. 点击 `一键启动`，或让远端 Agent 通过 `/control/start` 远程拉起。

#### 2. 远端 Agent 使用

先检查 bridge：

```bash
curl -s "http://<tailscale-ip>:<bridge-port>/json/version?token=<token>" --connect-timeout 5
```

如果本地浏览器还没准备好，可远程拉起：

```bash
curl -X POST "http://<tailscale-ip>:<bridge-port>/control/start?token=<token>&mode=clean"
curl -X POST "http://<tailscale-ip>:<bridge-port>/control/start?token=<token>&mode=advanced&profile=Default"
```

成功后再连接 bridge WS 地址。

### 高级模式建议

高级模式副本是**长期持久化**的。

推荐做法：

- 第一次进入高级模式时，把它当成一个新的独立浏览器
- 在里面完成登录、二次验证、必要授权
- 然后持续复用这个副本
- 不要频繁重置，除非你明确想重来

如果第一次登录 Gmail 或高风控站点仍要求验证身份，这是正常现象。关键是后续继续复用同一个副本，而不是反复重建。

### 开发者区

开发者区包含：

- `复制 Playwright 代码`
- `复制开发者 CDP 地址`
- `重置高级模式副本`

其中：

- `重置高级模式副本` 会删除当前高级副本
- 下次选择高级模式并点击 `一键启动` 时，会重新创建新的副本

### 通用 Agent Prompt

主推荐接入方式是点击：

- `复制通用 Agent Prompt`

这段 prompt 已经包含：

- bridge 地址
- 远程启动逻辑
- `clean` / `advanced` 模式选择方式
- WS 连接规则
- 失败时的返回要求

### 清洁重装

如果安装版行为异常、旧版本残留、托盘劫持或本地状态损坏，使用安装器中的：

- `Clean reinstall`

它会尝试清理旧安装、旧进程、旧用户态数据和快捷方式。

### 本地开发

安装依赖：

```bash
npm install
```

运行：

```bash
npm start
```

语法检查：

```bash
npm run check
```

打包 Windows 安装器：

```bash
npm run dist:win
```

输出文件：

```text
dist/CDP Bridge-Setup-0.2.1.exe
```

---

## English

### What This Solves

> “I want a remote agent to use the browser on my Windows machine.”  
> “I do not want to expose raw port 9222 or manually tweak firewall and Chrome flags.”  
> “I want both a clean isolated mode and a long-lived advanced browser replica.”

This project turns your local browser into a **controlled, remotely startable, Tailscale-secured CDP bridge**.

In plain English, it safely “lends” the browser on your Windows PC to a remote AI, so agents like OpenClaw, OpenCode, and Codex can open pages, read content, and perform browser actions as if they were sitting in front of your computer.

Maintained by `bsbofmusic`.

### Core Features

- Windows tray app that keeps the bridge available in the background
- Tailscale private-network access instead of exposing raw `9222`
- `Clean Mode` and `Advanced Mode`
- Remote browser startup through `/control/start`
- Generic Agent Prompt, Playwright snippet, and raw developer CDP URL
- `Reset Advanced Replica` support
- Clean reinstall recovery for broken packaged installs

### Modes

#### `Clean Mode`

- uses an isolated standalone profile
- starts fast and favors stability
- does not reuse your native browser login state or extensions
- best for automation and short-lived tasks

#### `Advanced Mode`

- creates a **standalone persistent browser replica**
- no longer performs a heavy full clone of native browser data by default
- works best when you sign in directly inside the replica and let the browser sync bookmarks, extensions, and history on its own
- ideal for building a long-lived “agent browser” over time

### How It Works

```text
Remote Agent
    │
    ├── Tailscale private network
    │
    └── CDP Bridge (Windows tray app)
          │
          ├── /control/start?mode=clean
          ├── /control/start?mode=advanced&profile=Default
          ├── /json/version?token=...
          └── /devtools/browser?token=...
                │
                ▼
             Local Chrome / Edge / Chromium
```

### Quick Start

#### 1. Install and Run

1. Install and sign in to Tailscale on the local Windows machine.
2. Install `CDP Bridge`.
3. Launch it and keep it in the tray.
4. Choose:
   - browser mode
   - page mode
   - Chrome user for Advanced Mode
5. Click `Start CDP`, or let the remote agent call `/control/start`.

#### 2. Remote Agent Flow

Check the bridge first:

```bash
curl -s "http://<tailscale-ip>:<bridge-port>/json/version?token=<token>" --connect-timeout 5
```

If the local browser is not ready yet, start it remotely:

```bash
curl -X POST "http://<tailscale-ip>:<bridge-port>/control/start?token=<token>&mode=clean"
curl -X POST "http://<tailscale-ip>:<bridge-port>/control/start?token=<token>&mode=advanced&profile=Default"
```

Then connect to the bridge WS endpoint.

### Advanced Mode Guidance

The Advanced replica is designed to be **persistent**.

Recommended approach:

- treat the first Advanced launch as a fresh standalone browser
- complete sign-in, verification, and required authorizations inside that replica
- keep reusing the same replica afterward
- only reset it when you intentionally want to start over

If Gmail or another high-risk site still asks for identity verification the first time, that is expected. The important part is to keep reusing the same warmed-up replica instead of rebuilding it repeatedly.

### Developer Area

The Developer section includes:

- `Copy Playwright Snippet`
- `Copy Developer CDP URL`
- `Reset Advanced Replica`

`Reset Advanced Replica` deletes the current Advanced replica. The next Advanced launch will create a fresh one.

### Generic Agent Prompt

The main recommended handoff is:

- `Copy Generic Agent Prompt`

It already includes:

- bridge endpoints
- remote startup logic
- clean / advanced mode selection
- WS connection rules
- failure reporting requirements

### Clean Reinstall

If the packaged app behaves oddly, old installs remain, the tray gets hijacked, or local runtime state is corrupted, use:

- `Clean reinstall`

It attempts to remove stale installs, old processes, stale runtime data, and old shortcuts.

### Local Development

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm start
```

Run syntax checks:

```bash
npm run check
```

Build the Windows installer:

```bash
npm run dist:win
```

Output:

```text
dist/CDP Bridge-Setup-0.2.1.exe
```

---

## License

MIT
