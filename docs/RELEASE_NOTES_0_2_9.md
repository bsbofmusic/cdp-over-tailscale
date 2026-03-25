# CDP Bridge 0.2.9

## Highlights

- Added `ensure-site-tab` remote API to reuse an existing trusted site tab before automation
- Added runtime diagnostics fields for `appDir` and `configPath`
- Improved portable mode config detection to avoid temp-directory drift
- Randomized Chrome launch window size for more human-like startup behavior

## New API

### `POST /control/ensure-site-tab`

Reuses an existing page matching a host or title hint, or creates a new page if needed.

Query params:

- `token`
- `url`
- `host` (optional)
- `titleHint` (optional)
- `activate` (optional, defaults to `true`)

Example:

```bash
curl -X POST "http://<tailscale-ip>:<bridge-port>/control/ensure-site-tab?token=<token>&url=https%3A%2F%2Fchatgpt.com%2F&host=chatgpt.com"
```

## Why this release matters

High-friction sites like ChatGPT and Doubao are often more stable when automation reuses an already-open trusted tab instead of always cold-starting a brand new page. This release adds the bridge-side primitive needed for that flow.

## Other improvements

- Portable builds no longer assume a writable `data/` directory beside a temp unpacked executable
- Status snapshots now expose where the running bridge reads its config from
- Desktop mode browser launches now use randomized viewport presets instead of one fixed size
