# Dataflow & Threat Model Index

> Per docs_zh/reference/automatic_agent_system_full_review_audit_methodology_v1_3_with_tests_relationship.md §32.
> 10 条核心 dataflow，每条标注 trust/tenant/secret/side-effect/evidence boundary + failure mode + required gate。

| # | Dataflow | File | Required gates | Coverage |
|---|---|---|---|---|
| 1 | User Request → Auth → Tenant Guard → Route → Service → Repository | [dataflow-1-user-request.md](./dataflow-1-user-request.md) | tenant-isolation, secret-sinks, contracts-sync, fire-and-forget, determinism | ✅ 6/6 |
| 2 | Task Intake → Planner → Execution → Tool → SideEffect → Receipt | [dataflow-2-task-intake.md](./dataflow-2-task-intake.md) | lease-fencing, side-effect-receipt, receipt-verification, audit-chain, event-outbox, plugin-security | ✅ 6/6 |
| 3 | Observation → Feedback → Learning → Knowledge Promotion → Memory | [dataflow-3-observation-feedback.md](./dataflow-3-observation-feedback.md) | secret-sinks, tenant-isolation, event-outbox, audit-chain, receipt-verification | ✅ 5/5 |
| 4 | Eval Dataset → Runner → Judge → Report → Release Gate | [dataflow-4-eval-dataset.md](./dataflow-4-eval-dataset.md) | eval-oracle, golden:strict, redteam:p0, evidence:bundle:* | ✅ 5/5 |
| 5 | Plugin Manifest → Signature → SBOM → Registry → Execution | [dataflow-5-plugin-manifest.md](./dataflow-5-plugin-manifest.md) | plugin-security, audit-chain, receipt-verification, event-outbox | ✅ 4/4 |
| 6 | Secret Provider → Runtime Config → Logger/Event/Span sinks | [dataflow-6-secret-provider.md](./dataflow-6-secret-provider.md) | secret-sinks, audit-chain, determinism | ✅ 3/3 |
| 7 | WebSocket Subscribe → Broadcast → Client Cache | [dataflow-7-websocket-subscribe.md](./dataflow-7-websocket-subscribe.md) | tenant-isolation, ui-token-storage, secret-sinks | ✅ 3/3 |
| 8 | Backup/Restore → File System → Remote URI → Retention | [dataflow-8-backup-restore.md](./dataflow-8-backup-restore.md) | path-safety, evidence:bundle:*, audit-chain | ✅ 4/4 |
| 9 | Mission Resolve → Mission Guard → NodeRun → Runtime Transition | [dataflow-9-mission-resolve.md](./dataflow-9-mission-resolve.md) | side-effect-receipt, audit-chain, event-outbox, invariants | ✅ 4/4 |
| 10 | YONO Market → Forecast → Order → Settlement → Reputation | [dataflow-10-yono-market.md](./dataflow-10-yono-market.md) | domain-coverage --mode=production-ready, side-effect-receipt, receipt-verification, audit-chain, event-outbox | ✅ 5/5 |

## 总结

- **完全覆盖**（所列 gate 已落地并已有定向验证）: 10 条
- **部分覆盖**: 0 条
- `audit:auth-role-mapping` 已实现并可通过自测/仓内扫描
- `test:redteam:p0` 与 `test:golden:strict` 已可直接跑通

## 后续 action item

1. 把 10 条 dataflow 文档纳入 `assurance:inventory` 的产物清单
2. 持续把 dataflow 级 gate 结果回写到 nightly assurance 报告
