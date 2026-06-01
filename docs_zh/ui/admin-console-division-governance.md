# Admin Console Division Governance

v3.3 只实现只读页面。

## 页面

- Division Inventory
- CoverageCard Viewer
- Scenario Registry
- Eval & Red-team Reports
- ROI Dashboard
- Release Gate Board
- Evidence Explorer
- Tool Risk Registry
- Budget Monitor

## 数据约束

- 数据必须来自 SOT 或 generated reports
- UI 不允许本地伪造 `production_ready`
- UI 不提供在线编辑

## v3.3 落地点

- `Division Inventory` 页面
- family / status / risk / blocker 过滤
- 覆盖 generated inventory 与 coverage card 摘要
