# Leadership Claims

本文件用于固定 v3.2 release 文档中“leadership claims 已落地”的当前权威目录与治理入口。

## 权威文件

- Claim records：`config/division-coverage/claims/records.yaml`
- Claim allowlist：`config/division-coverage/claims/allowlist.yaml`
- Claim schema：`config/division-coverage/schemas/leadership-claim.schema.json`
- Governance 数据：
  - `data/governance/leadership-claim-review-requests.json`
  - `data/governance/leadership-claim-status-overrides.json`
  - `data/governance/leadership-claim-scan-report.json`

## 实现入口

- CI 扫描器：`scripts/ci/audit-leadership-claims.mjs`
- 仓库脚本入口：`package.json` 中的 `audit:leadership-claims`
- 运行时治理服务：`src/platform/shared/stability/leadership-claims-governance-service.ts`
- Admin API：`src/platform/five-plane-interface/api/http-server/admin-routes.ts`
- Release Console UI / API client：
  - `ui/packages/features/release-console/`
  - `ui/packages/shared/api-client/src/endpoints.ts`

## 当前目录真相

当前仓库并没有按 family 拆分的 `claims/{engineering,knowledge-research,...}.yaml` 文件集合。  
claims 目录的权威结构是：

- `config/division-coverage/claims/records.yaml`
- `config/division-coverage/claims/allowlist.yaml`

如果未来确实引入 family-scoped claim 文件，需要先同步 schema、scanner、governance service、API 和 release 文档，再修改此索引页。
