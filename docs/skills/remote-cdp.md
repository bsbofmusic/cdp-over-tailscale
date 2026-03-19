# Remote CDP Skill
适用于OpenClaw等支持Skill的Agent，对接CDP Bridge + cdper实现网页自动化，开箱即用。

## 🎯 核心规则
### 1. 前置检查
所有CDP操作前必须执行窗口探针：
```bash
node /path/to/cdp-window-probe.js
```
- 窗口数>20时提醒用户，不自动清理，由用户决定是否清理
- 探针执行失败不阻断后续操作，只做提醒

### 2. cdper调用规范
使用`key=value`格式传参，禁止使用`--key value`格式：
```bash
# 单页抓取
mcporter call cdper.cdp_fetch url="https://example.com" extract_template="xiaohongshu-note"
# 截图
mcporter call cdper.cdp_screenshot url="https://example.com" save_path="./screenshot.png"
# 交互操作
mcporter call cdper.cdp_interact url="https://example.com" action="click" selector="#submit"
# 批量抓取
mcporter call cdper.cdp_batch_fetch urls='["https://example.com", "https://baidu.com"]'
```

### 3. 反爬优化规则
- 默认开启`anti_scraping=true`，自动使用随机UA、指纹、模拟滚动、真人延迟
- 高风控站点优先使用高级模式（带登录态的持久副本）
- 批量爬取并发默认≤2，避免触发风控

### 4. 故障排查
- 连接失败：先检查Tailscale连通性、token、端口、防火墙
- 反爬拦截：切换到高级模式、增加延迟、更换指纹
- CDP崩溃：调用`/control/start`重新拉起浏览器即可

## 📋 内置提取模板
| 模板名 | 适用场景 | 提取字段 |
|--------|----------|----------|
| xiaohongshu-note | 小红书笔记页 | 标题、点赞、收藏、评论、正文、作者、发布时间 |
| reddit-post | Reddit帖子页 | 标题、点赞、评论、正文、作者 |
| amazon-product | 亚马逊商品页 | 标题、价格、评分、评论数 |
