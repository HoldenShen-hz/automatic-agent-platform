# Family Readiness

本文件用于固定 v3.2 release 文档中“family readiness 已落地”的当前权威口径，避免目录树和机器可读配置再次漂移。

## 权威来源

- Family readiness 基线配置：`config/division-coverage/family-readiness.yaml`
- Benchmark 映射：`config/division-coverage/benchmark-map.yaml`
- Minimum leading evidence：`config/division-coverage/minimum-leading-evidence.yaml`
- Governance 数据快照：
  - `data/governance/leadership-claim-review-requests.json`
  - `data/governance/leadership-claim-status-overrides.json`
  - `data/governance/leadership-claim-scan-report.json`
- 运行时治理服务：`src/platform/shared/stability/leadership-claims-governance-service.ts`

## 当前目录真相

`docs_zh/divisions/` 当前不是“每个 family 一份 readiness 总览”的平铺结构，而是以下两类材料：

- `family-expansion/`
  - 描述 family 扩展建议、优先级和下一步落地路径。
- `*/leadership-evidence/`
  - 保存 coding、customer-service、knowledge-base 等已接入 family 的评估、风险、ROI、red team 和 release readiness 证据。

## 使用约束

- `family-readiness.yaml` 才是 readiness 判定的机器可读权威来源，本文档只是索引说明，不替代配置本身。
- “family readiness” 不等于“claim 已批准对外宣称”。
- 对外 claim 的权威来源是 `config/division-coverage/claims/records.yaml`，并叠加 review / override / revoke 的运行时治理状态。
- 如果本文档与机器可读配置或 governance 快照冲突，以配置和快照为准，并同步回写 release 文档。
