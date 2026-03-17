# Release Notes 0.2.1

## 中文

### 更新内容

- 新增远程启动接口，远端 Agent 可按需拉起 `干净模式` 或 `高级模式`
- 新增 `/control/start` 控制入口，支持远端指定浏览器模式与高级模式 profile
- `/json/version` 在本地 CDP 未就绪时改为返回更明确的 `503` 错误，而不是模糊的 `500 fetch failed`
- README 更新为双语版本，并补充远程启动、标准远端 Agent 使用流程和高级副本说明

### 远程启动示例

```bash
curl -X POST "http://<tailscale-ip>:<bridge-port>/control/start?token=<token>&mode=clean"
curl -X POST "http://<tailscale-ip>:<bridge-port>/control/start?token=<token>&mode=advanced&profile=Default"
```

### 说明

- 远端现在可以在 bridge 已在线但本地浏览器未准备好的情况下，主动拉起浏览器
- 高级模式副本仍然保持长期持久化复用
- 如需彻底重新生成高级副本，请在开发者区使用“重置高级模式副本”

---

## English

### What’s New

- Added remote start controls so a remote agent can start either `Clean Mode` or `Advanced Mode`
- Added `/control/start` for remote browser startup, including Advanced Mode profile selection
- `/json/version` now returns a clearer `503` when local CDP is not ready instead of a vague `500 fetch failed`
- Updated the README to a bilingual structure and documented remote startup, standard remote agent flow, and Advanced replica behavior

### Remote Start Examples

```bash
curl -X POST "http://<tailscale-ip>:<bridge-port>/control/start?token=<token>&mode=clean"
curl -X POST "http://<tailscale-ip>:<bridge-port>/control/start?token=<token>&mode=advanced&profile=Default"
```

### Notes

- A remote agent can now start the browser when the bridge is online but the local browser is not yet ready
- The Advanced replica remains persistent and reusable by default
- To rebuild the Advanced replica from scratch, use `Reset Advanced Replica` in the Developer section
