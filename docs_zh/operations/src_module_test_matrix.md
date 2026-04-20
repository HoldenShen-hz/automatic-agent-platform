# Src 模块测试矩阵

> 本文档由 `npm run test:matrix` 自动生成，用于回答“`src` 每个模块当前有哪些单元测试、哪些集成测试、还有哪些文件缺少直接覆盖”。

## 1. 统计规则

- 模块按 `src` 顶层目录归类，`src/core/*` 细分到 `core/<子模块>`。
- `tests/unit/` 视为单元测试；`tests/integration/`、`tests/e2e/`、`tests/golden/` 视为集成测试。
- “直接覆盖”按同 basename 或同目录 token 的测试文件推断，用于维护视角，不替代覆盖率报告。
- `index.ts`、type-only 文件也会进入矩阵；若没有直接测试，会出现在“缺少直接覆盖”中。

## 2. 概览

| 模块 | 源文件数 | 单元测试数 | 集成测试数 | 缺少直接覆盖 | 状态 |
| --- | ---: | ---: | ---: | ---: | --- |
| `cli` | 74 | 2 | 27 | 45 | `needs_review` |
| `core/api` | 24 | 25 | 3 | 10 | `needs_review` |
| `core/approvals` | 3 | 14 | 0 | 0 | `covered` |
| `core/artifacts` | 2 | 13 | 1 | 0 | `covered` |
| `core/cache` | 25 | 37 | 0 | 6 | `needs_review` |
| `core/compliance` | 2 | 13 | 0 | 0 | `covered` |
| `core/config` | 26 | 32 | 3 | 1 | `needs_review` |
| `core/constants` | 2 | 13 | 0 | 0 | `covered` |
| `core/cost` | 2 | 14 | 0 | 0 | `covered` |
| `core/deployment` | 2 | 13 | 0 | 0 | `covered` |
| `core/divisions` | 4 | 8 | 3 | 0 | `covered` |
| `core/errors.ts` | 1 | 3 | 0 | 0 | `covered` |
| `core/evaluation` | 3 | 5 | 0 | 0 | `covered` |
| `core/events` | 6 | 7 | 1 | 0 | `covered` |
| `core/evolution` | 11 | 25 | 1 | 0 | `covered` |
| `core/hr` | 2 | 13 | 2 | 0 | `covered` |
| `core/lifecycle` | 2 | 3 | 1 | 0 | `covered` |
| `core/locking` | 8 | 18 | 0 | 3 | `needs_review` |
| `core/memory` | 11 | 26 | 1 | 0 | `covered` |
| `core/messages` | 2 | 4 | 0 | 0 | `covered` |
| `core/observability` | 20 | 20 | 2 | 3 | `needs_review` |
| `core/ops` | 16 | 21 | 0 | 1 | `needs_review` |
| `core/orchestration` | 3 | 5 | 0 | 0 | `covered` |
| `core/product` | 17 | 22 | 6 | 1 | `needs_review` |
| `core/providers` | 9 | 14 | 2 | 0 | `covered` |
| `core/queue` | 6 | 16 | 0 | 2 | `needs_review` |
| `core/reliability` | 8 | 24 | 0 | 0 | `covered` |
| `core/resource` | 2 | 14 | 0 | 0 | `covered` |
| `core/results` | 2 | 13 | 0 | 0 | `covered` |
| `core/runtime` | 76 | 92 | 18 | 0 | `covered` |
| `core/security` | 18 | 26 | 2 | 3 | `needs_review` |
| `core/stability` | 31 | 28 | 25 | 0 | `covered` |
| `core/storage` | 80 | 27 | 2 | 64 | `needs_review` |
| `core/tools` | 36 | 45 | 4 | 3 | `needs_review` |
| `core/types` | 20 | 33 | 1 | 1 | `needs_review` |
| `core/utils` | 2 | 13 | 1 | 0 | `covered` |
| `core/workflow` | 4 | 9 | 1 | 0 | `covered` |
| `gateway` | 11 | 11 | 0 | 3 | `needs_review` |
| `index.ts` | 1 | 11 | 0 | 0 | `covered` |

## 3. 模块明细

### cli

- 源文件数：74
- 单元测试：2
- 集成测试：27
- 缺少直接覆盖：45

单元测试：
- `tests/unit/cli/authoritative-storage.test.ts`
- `tests/unit/config/profile-home.test.ts`

集成测试：
- `tests/integration/cli/billing-cli.test.ts`
- `tests/integration/cli/channel-gateway-cli.test.ts`
- `tests/integration/cli/compliance-program-cli.test.ts`
- `tests/integration/cli/control-plane-balancer-cli.test.ts`
- `tests/integration/cli/data-plane-cli.test.ts`
- `tests/integration/cli/deployment-execution-cli.test.ts`
- `tests/integration/cli/enterprise-capability-cli.test.ts`
- `tests/integration/cli/enterprise-governance-cli.test.ts`
- `tests/integration/cli/environment-deployment-cli.test.ts`
- `tests/integration/cli/evolution-cli.test.ts`
- `tests/integration/cli/gateway-targets-cli.test.ts`
- `tests/integration/cli/ha-program-cli.test.ts`
- `tests/integration/cli/marketplace-cli.test.ts`
- `tests/integration/cli/memory-cli.test.ts`
- `tests/integration/cli/model-routing-cli.test.ts`
- `tests/integration/cli/ops-governance-cli.test.ts`
- `tests/integration/cli/ops-program-cli.test.ts`
- `tests/integration/cli/perception-cli.test.ts`
- `tests/integration/cli/platform-operator-cli.test.ts`
- `tests/integration/cli/pmf-cli.test.ts`
- `tests/integration/cli/release-pipeline-cli.test.ts`
- `tests/integration/cli/secret-management-cli.test.ts`
- `tests/integration/cli/shadow-snapshot-cli.test.ts`
- `tests/integration/cli/skill-creator-cli.test.ts`
- `tests/integration/cli/tenant-platform-cli.test.ts`
- `tests/integration/observability/task-board.test.ts`
- `tests/integration/ops/doctor.test.ts`

缺少直接覆盖的源文件：
- `src/cli/api-server.ts`
- `src/cli/authoritative-storage-admin.ts`
- `src/cli/diagnostics.ts`
- `src/cli/dispatch-execution.ts`
- `src/cli/dispatch-reconcile.ts`
- `src/cli/drain-events.ts`
- `src/cli/governance-bootstrap.ts`
- `src/cli/inspect.ts`
- `src/cli/lease-handover.ts`
- `src/cli/orphan-cleanup.ts`
- `src/cli/phase1b-demo.ts`
- `src/cli/repair.ts`
- `src/cli/replay-events.ts`
- `src/cli/replay-recovery.ts`
- `src/cli/stable-campaign.ts`
- `src/cli/stable-chaos.ts`
- `src/cli/stable-concurrency.ts`
- `src/cli/stable-db-queue-disconnect.ts`
- `src/cli/stable-db-writability.ts`
- `src/cli/stable-dispatch-reconcile.ts`
- `src/cli/stable-dispatch.ts`
- `src/cli/stable-evidence.ts`
- `src/cli/stable-gate.ts`
- `src/cli/stable-gray.ts`
- `src/cli/stable-lease.ts`
- `src/cli/stable-maintenance.ts`
- `src/cli/stable-migration-compatibility.ts`
- `src/cli/stable-package.ts`
- `src/cli/stable-prompt-injection.ts`
- `src/cli/stable-queue-delivery.ts`
- `src/cli/stable-recovery-drill.ts`
- `src/cli/stable-replay.ts`
- `src/cli/stable-restore.ts`
- `src/cli/stable-rollback.ts`
- `src/cli/stable-runner-factory.ts`
- `src/cli/stable-sequence.ts`
- `src/cli/stable-soak.ts`
- `src/cli/stable-upgrade.ts`
- `src/cli/stable-validate.ts`
- `src/cli/stable-worker-handshake.ts`
- `src/cli/stable-worker-writeback.ts`
- `src/cli/takeover.ts`
- `src/cli/worker-handshake.ts`
- `src/cli/worker-register.ts`
- `src/cli/worker-writeback.ts`

### core/api

- 源文件数：24
- 单元测试：25
- 集成测试：3
- 缺少直接覆盖：10

单元测试：
- `tests/unit/api/api-auth-service.test.ts`
- `tests/unit/api/api-error.test.ts`
- `tests/unit/api/http-api-server.test.ts`
- `tests/unit/api/mission-control-service.test.ts`
- `tests/unit/api/oidc-oauth-service.test.ts`
- `tests/unit/api/openapi-document.test.ts`
- `tests/unit/core/api/crypto-utils.test.ts`
- `tests/unit/core/api/http-server/request-helpers.test.ts`
- `tests/unit/core/api/http-server/schemas.test.ts`
- `tests/unit/core/api/http-server/types.test.ts`
- `tests/unit/core/api/jwt-utils.test.ts`
- `tests/unit/core/api/oidc-oauth-service.test.ts`
- `tests/unit/core/api/openapi-document.test.ts`
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/execution-lease/utils.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`

集成测试：
- `tests/integration/api/http-api-server-auth-gateway-load.test.ts`
- `tests/integration/api/http-api-server.test.ts`
- `tests/integration/security/http-api-server.test.ts`

缺少直接覆盖的源文件：
- `src/core/api/http-server/admin-routes.ts`
- `src/core/api/http-server/approval-routes.ts`
- `src/core/api/http-server/auth-routes.ts`
- `src/core/api/http-server/billing-routes.ts`
- `src/core/api/http-server/console-routes.ts`
- `src/core/api/http-server/dashboard-routes.ts`
- `src/core/api/http-server/division-routes.ts`
- `src/core/api/http-server/gateway-routes.ts`
- `src/core/api/http-server/health-routes.ts`
- `src/core/api/http-server/task-routes.ts`

### core/approvals

- 源文件数：3
- 单元测试：14
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/approvals/approval-service.test.ts`
- `tests/unit/core/approvals/approval-service.test.ts`
- `tests/unit/core/approvals/approval-timeout-executor-types.test.ts`
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`

### core/artifacts

- 源文件数：2
- 单元测试：13
- 集成测试：1
- 缺少直接覆盖：0

单元测试：
- `tests/unit/artifacts/artifact-store.test.ts`
- `tests/unit/core/artifacts/artifact-store.test.ts`
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`

集成测试：
- `tests/integration/security/artifact-store.test.ts`

### core/cache

- 源文件数：25
- 单元测试：37
- 集成测试：0
- 缺少直接覆盖：6

单元测试：
- `tests/unit/cache/cache-bootstrap.test.ts`
- `tests/unit/cache/cache-errors.test.ts`
- `tests/unit/cache/cache-facade.test.ts`
- `tests/unit/cache/cache-governance-middleware.test.ts`
- `tests/unit/cache/cache-key-factory.test.ts`
- `tests/unit/cache/cache-metrics.test.ts`
- `tests/unit/cache/cache-normalizer.test.ts`
- `tests/unit/cache/cache-orchestration-service.test.ts`
- `tests/unit/cache/cache-policy.test.ts`
- `tests/unit/cache/memory-cache-store.test.ts`
- `tests/unit/cache/multi-level-cache-store.test.ts`
- `tests/unit/cache/normalize-path.test.ts`
- `tests/unit/cache/normalize-query.test.ts`
- `tests/unit/cache/sqlite-cache-store.test.ts`
- `tests/unit/cache/stable-hash.test.ts`
- `tests/unit/cache/stable-stringify.test.ts`
- `tests/unit/core/cache/cache-errors.test.ts`
- `tests/unit/core/cache/cache-key-factory.test.ts`
- `tests/unit/core/cache/cache-normalizer.test.ts`
- `tests/unit/core/cache/cache-policy.test.ts`
- `tests/unit/core/cache/cache-types.test.ts`
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/cache/utils/normalize-path.test.ts`
- `tests/unit/core/cache/utils/normalize-query.test.ts`
- `tests/unit/core/cache/utils/stable-hash.test.ts`
- `tests/unit/core/cache/utils/stable-stringify.test.ts`
- `tests/unit/core/cache/utils/tag-builder.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`

缺少直接覆盖的源文件：
- `src/core/cache/cache-invalidation.ts`
- `src/core/cache/policies/memory-cache-policy.ts`
- `src/core/cache/policies/planner-cache-policy.ts`
- `src/core/cache/policies/prompt-cache-policy.ts`
- `src/core/cache/policies/tool-cache-policy.ts`
- `src/core/cache/stores/cache-store.ts`

### core/compliance

- 源文件数：2
- 单元测试：13
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/compliance/audit-export-service.test.ts`
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/audit-export-service.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`

### core/config

- 源文件数：26
- 单元测试：32
- 集成测试：3
- 缺少直接覆盖：1

单元测试：
- `tests/unit/config/api-server-env.test.ts`
- `tests/unit/config/billing-env.test.ts`
- `tests/unit/config/billing-plan-catalog.test.ts`
- `tests/unit/config/channel-gateway-env.test.ts`
- `tests/unit/config/config-governance-service.test.ts`
- `tests/unit/config/config-governance-support.test.ts`
- `tests/unit/config/config-override-governance.test.ts`
- `tests/unit/config/diagnostics-cli-env.test.ts`
- `tests/unit/config/gateway-env.test.ts`
- `tests/unit/config/model-metadata-registry.test.ts`
- `tests/unit/config/operations-cli-env.test.ts`
- `tests/unit/config/ops-cli-env.test.ts`
- `tests/unit/config/postgres-pool-env.test.ts`
- `tests/unit/config/product-cli-env.test.ts`
- `tests/unit/config/profile-home.test.ts`
- `tests/unit/config/protected-governance-integrity-service.test.ts`
- `tests/unit/config/provider-defaults.test.ts`
- `tests/unit/config/release-pipeline-env.test.ts`
- `tests/unit/config/remaining-cli-env-support.test.ts`
- `tests/unit/config/remaining-cli-env.test.ts`
- `tests/unit/config/resource-ceiling.test.ts`
- `tests/unit/config/runtime-env.test.ts`
- `tests/unit/config/runtime-ops-env.test.ts`
- `tests/unit/config/stable-cli-env.test.ts`
- `tests/unit/config/takeover-cli-env.test.ts`
- `tests/unit/core/config/config-governance-support.test.ts`
- `tests/unit/core/config/config-override-governance.test.ts`
- `tests/unit/core/config/model-metadata-registry.test.ts`
- `tests/unit/core/config/provider-defaults.test.ts`
- `tests/unit/core/config/remaining-cli-env-support.test.ts`
- `tests/unit/core/config/runtime-env-types.test.ts`
- `tests/unit/core/config/runtime-env.test.ts`

集成测试：
- `tests/integration/config/provider-defaults-integration.test.ts`
- `tests/integration/security/config-governance-service.test.ts`
- `tests/integration/security/protected-governance-integrity-service.test.ts`

缺少直接覆盖的源文件：
- `src/core/config/remaining-cli-env-loaders.ts`

### core/constants

- 源文件数：2
- 单元测试：13
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/constants/time.test.ts`
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/constants/time.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`

### core/cost

- 源文件数：2
- 单元测试：14
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/budget-guard-types.test.ts`
- `tests/unit/core/cost/budget-guard.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/cost/budget-guard.test.ts`

### core/deployment

- 源文件数：2
- 单元测试：13
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/deployment/traffic-routing-service.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/deployment/traffic-routing-service.test.ts`

### core/divisions

- 源文件数：4
- 单元测试：8
- 集成测试：3
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/divisions/division-loader-support-types.test.ts`
- `tests/unit/core/divisions/division-loader-support.test.ts`
- `tests/unit/core/divisions/division-loader-types.test.ts`
- `tests/unit/core/divisions/safe-load-division-registry.test.ts`
- `tests/unit/core/hr/hr-role-governance-service.test.ts`
- `tests/unit/divisions/division-loader-support.test.ts`
- `tests/unit/divisions/division-loader.test.ts`
- `tests/unit/hr/hr-role-governance-service.test.ts`

集成测试：
- `tests/integration/runtime/hr-role-governance-service.test.ts`
- `tests/integration/security/division-loader.test.ts`
- `tests/integration/security/hr-role-governance-service.test.ts`

### core/errors.ts

- 源文件数：1
- 单元测试：3
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/cache-errors.test.ts`
- `tests/unit/core/errors.test.ts`
- `tests/unit/gateway/channel-gateway/errors.test.ts`

### core/evaluation

- 源文件数：3
- 单元测试：5
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/evaluation/llm-eval-service-types.test.ts`
- `tests/unit/core/evaluation/llm-eval-service.test.ts`
- `tests/unit/core/evaluation/prompt-model-policy-governance-schema.test.ts`
- `tests/unit/evaluation/llm-eval-service.test.ts`
- `tests/unit/evaluation/prompt-model-policy-governance-service.test.ts`

### core/events

- 源文件数：6
- 单元测试：7
- 集成测试：1
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/events/event-registry.test.ts`
- `tests/unit/core/events/event-types.test.ts`
- `tests/unit/core/events/typed-event-payloads.test.ts`
- `tests/unit/events/durable-event-bus.test.ts`
- `tests/unit/events/event-registry.test.ts`
- `tests/unit/events/event-types.test.ts`
- `tests/unit/events/typed-event-bus.test.ts`

集成测试：
- `tests/integration/events/event-ops-service.test.ts`

### core/evolution

- 源文件数：11
- 单元测试：25
- 集成测试：1
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/evolution/evidence-store.test.ts`
- `tests/unit/core/evolution/evolution-integration-service-types.test.ts`
- `tests/unit/core/evolution/evolution-mvp-support.test.ts`
- `tests/unit/core/evolution/evolution-registry.test.ts`
- `tests/unit/core/evolution/promotion-gate.test.ts`
- `tests/unit/core/evolution/reflection-engine.test.ts`
- `tests/unit/core/evolution/rollout-manager.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/evolution/benchmark-runner.test.ts`
- `tests/unit/evolution/evidence-store.test.ts`
- `tests/unit/evolution/evolution-mvp-service.test.ts`
- `tests/unit/evolution/promotion-gate.test.ts`
- `tests/unit/evolution/proposal-engine.test.ts`
- `tests/unit/evolution/reflection-engine.test.ts`
- `tests/unit/evolution/rollout-manager.test.ts`

集成测试：
- `tests/integration/security/evolution-mvp-service.test.ts`

### core/hr

- 源文件数：2
- 单元测试：13
- 集成测试：2
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/hr/hr-role-governance-service.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/hr/hr-role-governance-service.test.ts`

集成测试：
- `tests/integration/runtime/hr-role-governance-service.test.ts`
- `tests/integration/security/hr-role-governance-service.test.ts`

### core/lifecycle

- 源文件数：2
- 单元测试：3
- 集成测试：1
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/lifecycle/service-registry.test.ts`
- `tests/unit/evolution/evolution-mvp-service.test.ts`
- `tests/unit/lifecycle/service-registry.test.ts`

集成测试：
- `tests/integration/security/evolution-mvp-service.test.ts`

### core/locking

- 源文件数：8
- 单元测试：18
- 集成测试：0
- 缺少直接覆盖：3

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/locking/distributed-lock-factory.test.ts`
- `tests/unit/core/locking/distributed-lock-types.test.ts`
- `tests/unit/core/locking/locking-support.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/locking/distributed-lock-factory.test.ts`
- `tests/unit/locking/distributed-lock-service.test.ts`
- `tests/unit/locking/distributed-lock-types.test.ts`
- `tests/unit/locking/locking-support.test.ts`

缺少直接覆盖的源文件：
- `src/core/locking/pg-advisory-lock-adapter.ts`
- `src/core/locking/redis-lock-adapter.ts`
- `src/core/locking/sqlite-lock-adapter.ts`

### core/memory

- 源文件数：11
- 单元测试：26
- 集成测试：1
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/memory/memory-consolidation.test.ts`
- `tests/unit/core/memory/memory-quality-types.test.ts`
- `tests/unit/core/memory/memory-quality.test.ts`
- `tests/unit/core/memory/memory-retrieval-service.test.ts`
- `tests/unit/core/memory/memory-schema-types.test.ts`
- `tests/unit/core/memory/memory-schema.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/memory/builtin-memory-provider.test.ts`
- `tests/unit/memory/experience-cache-service.test.ts`
- `tests/unit/memory/memory-consolidation.test.ts`
- `tests/unit/memory/memory-plane-service.test.ts`
- `tests/unit/memory/memory-quality.test.ts`
- `tests/unit/memory/memory-retrieval-service.test.ts`
- `tests/unit/memory/memory-schema.test.ts`
- `tests/unit/memory/memory-service.test.ts`
- `tests/unit/memory/session-summary-service.test.ts`

集成测试：
- `tests/integration/memory/memory-service-integration.test.ts`

### core/messages

- 源文件数：2
- 单元测试：4
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/messages/message-parts.test.ts`
- `tests/unit/core/messages/token-estimator.test.ts`
- `tests/unit/messages/message-parts.test.ts`
- `tests/unit/messages/token-estimator.test.ts`

### core/observability

- 源文件数：20
- 单元测试：20
- 集成测试：2
- 缺少直接覆盖：3

单元测试：
- `tests/unit/core/api/http-server/types.test.ts`
- `tests/unit/core/observability/diagnostics-support-types.test.ts`
- `tests/unit/core/observability/diagnostics-support.test.ts`
- `tests/unit/core/observability/inspect-service-support.test.ts`
- `tests/unit/core/observability/provider-health-tracker-types.test.ts`
- `tests/unit/core/observability/structured-logger.test.ts`
- `tests/unit/core/observability/trace-context.test.ts`
- `tests/unit/observability/anomaly-detection-service.test.ts`
- `tests/unit/observability/diagnostics-service.test.ts`
- `tests/unit/observability/health-service.test.ts`
- `tests/unit/observability/inspect-service.test.ts`
- `tests/unit/observability/metrics-service.test.ts`
- `tests/unit/observability/observability-retention-service.test.ts`
- `tests/unit/observability/prometheus-metrics-exporter.test.ts`
- `tests/unit/observability/provider-health-tracker.test.ts`
- `tests/unit/observability/sli-collection-service.test.ts`
- `tests/unit/observability/slo-alerting-service.test.ts`
- `tests/unit/observability/structured-logger.test.ts`
- `tests/unit/observability/task-board-service.test.ts`
- `tests/unit/observability/trace-context.test.ts`

集成测试：
- `tests/integration/observability/metrics-service.test.ts`
- `tests/integration/security/observability-retention-service.test.ts`

缺少直接覆盖的源文件：
- `src/core/observability/anomaly-detection/constants.ts`
- `src/core/observability/diagnostics-export-service.ts`
- `src/core/observability/task-timeline-service.ts`

### core/ops

- 源文件数：16
- 单元测试：21
- 集成测试：0
- 缺少直接覆盖：1

单元测试：
- `tests/unit/core/ops/auto-stop-loss-service-types.test.ts`
- `tests/unit/core/ops/auto-stop-loss-service.test.ts`
- `tests/unit/core/ops/enterprise-governance-support.test.ts`
- `tests/unit/core/ops/human-takeover-support.test.ts`
- `tests/unit/core/ops/release-pipeline-support.test.ts`
- `tests/unit/core/ops/runtime-version-snapshot.test.ts`
- `tests/unit/core/ops/workflow-dispatch-receipt.test.ts`
- `tests/unit/ops/auto-stop-loss-service.test.ts`
- `tests/unit/ops/deployment-execution-service.test.ts`
- `tests/unit/ops/doctor-service.test.ts`
- `tests/unit/ops/enterprise-governance-schema.test.ts`
- `tests/unit/ops/enterprise-governance-service.test.ts`
- `tests/unit/ops/environment-deployment-service.test.ts`
- `tests/unit/ops/human-takeover-support.test.ts`
- `tests/unit/ops/industrial-ops-program-service.test.ts`
- `tests/unit/ops/operations-governance-service.test.ts`
- `tests/unit/ops/release-pipeline-service.test.ts`
- `tests/unit/ops/release-pipeline-support.test.ts`
- `tests/unit/ops/runtime-version-snapshot.test.ts`
- `tests/unit/ops/tenant-execution-isolation-service.test.ts`
- `tests/unit/ops/workflow-dispatch-receipt.test.ts`

缺少直接覆盖的源文件：
- `src/core/ops/human-takeover-service.ts`

### core/orchestration

- 源文件数：3
- 单元测试：5
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/orchestration/agent-team-service.test.ts`
- `tests/unit/core/orchestration/intake-router.test.ts`
- `tests/unit/orchestration/agent-team-service.test.ts`
- `tests/unit/orchestration/intake-router.test.ts`
- `tests/unit/orchestration/workflow-planner.test.ts`

### core/product

- 源文件数：17
- 单元测试：22
- 集成测试：6
- 缺少直接覆盖：1

单元测试：
- `tests/unit/core/api/http-server/types.test.ts`
- `tests/unit/core/product/billing-payment-gateway-types.test.ts`
- `tests/unit/core/product/billing-service.test.ts`
- `tests/unit/core/product/compliance-program-service-types.test.ts`
- `tests/unit/core/product/cost-estimation-service-types.test.ts`
- `tests/unit/core/product/data-plane-flow-service-types.test.ts`
- `tests/unit/core/product/enterprise-capability-matrix-service-types.test.ts`
- `tests/unit/core/product/ha-program-service-types.test.ts`
- `tests/unit/core/product/perception-service-types.test.ts`
- `tests/unit/core/product/platform-operator-service-types.test.ts`
- `tests/unit/core/runtime/execution-lease/utils.test.ts`
- `tests/unit/product/billing-payment-gateway.test.ts`
- `tests/unit/product/billing-service.test.ts`
- `tests/unit/product/compliance-program-service.test.ts`
- `tests/unit/product/data-plane-flow-service.test.ts`
- `tests/unit/product/enterprise-capability-matrix-service.test.ts`
- `tests/unit/product/ha-program-service.test.ts`
- `tests/unit/product/marketplace-governance-service.test.ts`
- `tests/unit/product/perception-service.test.ts`
- `tests/unit/product/platform-operator-service.test.ts`
- `tests/unit/product/pmf-validation-service.test.ts`
- `tests/unit/product/tenant-platform-service.test.ts`

集成测试：
- `tests/integration/product/billing-service.test.ts`
- `tests/integration/product/perception-service.test.ts`
- `tests/integration/product/pmf-validation-service.test.ts`
- `tests/integration/security/billing-service.test.ts`
- `tests/integration/security/perception-service.test.ts`
- `tests/integration/security/pmf-validation-service.test.ts`

缺少直接覆盖的源文件：
- `src/core/product/pmf-validation/report-format.ts`

### core/providers

- 源文件数：9
- 单元测试：14
- 集成测试：2
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/providers/base-chat-provider.test.ts`
- `tests/unit/core/providers/circuit-breaker.test.ts`
- `tests/unit/core/providers/model-routing-service-types.test.ts`
- `tests/unit/core/providers/provider-credential-pool-support.test.ts`
- `tests/unit/core/providers/unified-chat-provider-types.test.ts`
- `tests/unit/providers/anthropic-chat-service.test.ts`
- `tests/unit/providers/base-chat-provider.test.ts`
- `tests/unit/providers/circuit-breaker.test.ts`
- `tests/unit/providers/minimax-chat-service.test.ts`
- `tests/unit/providers/model-routing-service.test.ts`
- `tests/unit/providers/openai-chat-service.test.ts`
- `tests/unit/providers/provider-credential-pool-support.test.ts`
- `tests/unit/providers/provider-credential-pool.test.ts`
- `tests/unit/providers/unified-chat-provider.test.ts`

集成测试：
- `tests/integration/providers/circuit-breaker-integration.test.ts`
- `tests/integration/providers/provider-credential-pool-integration.test.ts`

### core/queue

- 源文件数：6
- 单元测试：16
- 集成测试：0
- 缺少直接覆盖：2

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/queue/queue-adapter-factory.test.ts`
- `tests/unit/core/queue/queue-adapter-types.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/queue/queue-adapter-factory.test.ts`
- `tests/unit/queue/queue-adapter-types.test.ts`
- `tests/unit/queue/queue-adapter.test.ts`

缺少直接覆盖的源文件：
- `src/core/queue/redis-queue-adapter.ts`
- `src/core/queue/sqlite-queue-adapter.ts`

### core/reliability

- 源文件数：8
- 单元测试：24
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/reliability/failure-classification.test.ts`
- `tests/unit/core/reliability/patch-bundle.test.ts`
- `tests/unit/core/reliability/release-record.test.ts`
- `tests/unit/core/reliability/review-report.test.ts`
- `tests/unit/core/reliability/task-card.test.ts`
- `tests/unit/core/reliability/validation-report.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/reliability/failure-classification.test.ts`
- `tests/unit/reliability/patch-bundle.test.ts`
- `tests/unit/reliability/release-record.test.ts`
- `tests/unit/reliability/repair-pipeline.test.ts`
- `tests/unit/reliability/review-report.test.ts`
- `tests/unit/reliability/task-card.test.ts`
- `tests/unit/reliability/validation-report.test.ts`

### core/resource

- 源文件数：2
- 单元测试：14
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/resource/process-tracker.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/process-tracker.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/resource/process-tracker.test.ts`

### core/results

- 源文件数：2
- 单元测试：13
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/results/result-envelope.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/results/result-envelope.test.ts`

### core/runtime

- 源文件数：76
- 单元测试：92
- 集成测试：18
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/api/http-server/types.test.ts`
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/resource/process-tracker.test.ts`
- `tests/unit/core/runtime/call-governance.test.ts`
- `tests/unit/core/runtime/complexity-router.test.ts`
- `tests/unit/core/runtime/control-plane-load-balancing-schema.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/effect-buffer.test.ts`
- `tests/unit/core/runtime/execution-dispatch-support.test.ts`
- `tests/unit/core/runtime/execution-lease/utils.test.ts`
- `tests/unit/core/runtime/execution-priority-preemption-service-types.test.ts`
- `tests/unit/core/runtime/execution-resource-monitor.test.ts`
- `tests/unit/core/runtime/execution-worker-handshake-support.test.ts`
- `tests/unit/core/runtime/execution-worker-handshake-types.test.ts`
- `tests/unit/core/runtime/execution-worker-writeback-support.test.ts`
- `tests/unit/core/runtime/graceful-shutdown.test.ts`
- `tests/unit/core/runtime/ha-coordinator/mappers.test.ts`
- `tests/unit/core/runtime/license-enforcement-service.test.ts`
- `tests/unit/core/runtime/loop-detection.test.ts`
- `tests/unit/core/runtime/middleware-init.test.ts`
- `tests/unit/core/runtime/model-call-provider.test.ts`
- `tests/unit/core/runtime/multi-step-orchestration.test.ts`
- `tests/unit/core/runtime/orchestration/multi-step-tool-definitions.test.ts`
- `tests/unit/core/runtime/orchestration/multi-step-utils.test.ts`
- `tests/unit/core/runtime/orchestration/phase1b-tool-definitions.test.ts`
- `tests/unit/core/runtime/orchestration/phase1b-utils.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/output-continuation-service.test.ts`
- `tests/unit/core/runtime/phase1a-happy-path.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/process-tracker.test.ts`
- `tests/unit/core/runtime/prompt-partition-cache.test.ts`
- `tests/unit/core/runtime/remote-session-guard.test.ts`
- `tests/unit/core/runtime/runtime-context.test.ts`
- `tests/unit/core/runtime/runtime-repair-service.test.ts`
- `tests/unit/core/runtime/session-lifecycle.test.ts`
- `tests/unit/core/runtime/single-task-execution.test.ts`
- `tests/unit/core/runtime/single-task-happy-path.test.ts`
- `tests/unit/core/runtime/startup-consistency-checker.test.ts`
- `tests/unit/core/runtime/state-transition-machine.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/core/runtime/tight-loop-detector.test.ts`
- `tests/unit/core/runtime/validation-repair-loop.test.ts`
- `tests/unit/core/runtime/worker-load-balancing.test.ts`
- `tests/unit/core/runtime/worker-scheduling-status.test.ts`
- `tests/unit/locking/distributed-lock-service.test.ts`
- `tests/unit/queue/queue-adapter.test.ts`
- `tests/unit/resource/process-tracker.test.ts`
- `tests/unit/runtime/admission-controller.test.ts`
- `tests/unit/runtime/agent-executor.test.ts`
- `tests/unit/runtime/agent-middleware-chain.test.ts`
- `tests/unit/runtime/call-governance.test.ts`
- `tests/unit/runtime/complexity-router.test.ts`
- `tests/unit/runtime/coordinator-load-balancing-service.test.ts`
- `tests/unit/runtime/cross-region-deployment-service.test.ts`
- `tests/unit/runtime/effect-buffer.test.ts`
- `tests/unit/runtime/execution-db-queue-disconnect-repair-service.test.ts`
- `tests/unit/runtime/execution-dispatch-service.test.ts`
- `tests/unit/runtime/execution-lease-service.test.ts`
- `tests/unit/runtime/execution-priority-preemption-service.test.ts`
- `tests/unit/runtime/execution-resource-ceiling-guard.test.ts`
- `tests/unit/runtime/graceful-shutdown.test.ts`
- `tests/unit/runtime/ha-coordinator-service.test.ts`
- `tests/unit/runtime/hitl-explainability-service.test.ts`
- `tests/unit/runtime/hot-upgrade-service.test.ts`
- `tests/unit/runtime/license-enforcement-service.test.ts`
- `tests/unit/runtime/loop-detection.test.ts`
- `tests/unit/runtime/multi-step-utils.test.ts`
- `tests/unit/runtime/orphan-cleanup-service.test.ts`
- `tests/unit/runtime/output-continuation-service.test.ts`
- `tests/unit/runtime/prompt-partition-cache.test.ts`
- `tests/unit/runtime/remote-session-guard.test.ts`
- `tests/unit/runtime/remote-worker-registration-service.test.ts`
- `tests/unit/runtime/runtime-context.test.ts`
- `tests/unit/runtime/session-lifecycle.test.ts`
- `tests/unit/runtime/stalled-execution-detector.test.ts`
- `tests/unit/runtime/stalled-execution-escalation-service.test.ts`
- `tests/unit/runtime/startup-preflight.test.ts`
- `tests/unit/runtime/state-transition-machine.test.ts`
- `tests/unit/runtime/tight-loop-detector.test.ts`
- `tests/unit/runtime/transition-service.test.ts`
- `tests/unit/runtime/validation-repair-loop.test.ts`
- `tests/unit/runtime/worker-load-balancing.test.ts`
- `tests/unit/runtime/worker-scheduling-status.test.ts`
- `tests/unit/runtime/workflow-crash-simulator.test.ts`
- `tests/unit/runtime/workflow-step-checkpoint.test.ts`

集成测试：
- `tests/integration/runtime/agent-executor.test.ts`
- `tests/integration/runtime/context-compaction-service.test.ts`
- `tests/integration/runtime/execution-db-queue-disconnect-repair-service.test.ts`
- `tests/integration/runtime/execution-dispatch-reconciliation-service.test.ts`
- `tests/integration/runtime/execution-dispatch-service.test.ts`
- `tests/integration/runtime/execution-lease-service.test.ts`
- `tests/integration/runtime/execution-worker-handshake-service.test.ts`
- `tests/integration/runtime/execution-worker-writeback-service.test.ts`
- `tests/integration/runtime/orphan-cleanup-service.test.ts`
- `tests/integration/runtime/output-continuation-service.test.ts`
- `tests/integration/runtime/phase1b-orchestration.test.ts`
- `tests/integration/runtime/runtime-recovery-decision-service.test.ts`
- `tests/integration/runtime/runtime-recovery-replay-service.test.ts`
- `tests/integration/runtime/runtime-recovery-service.test.ts`
- `tests/integration/runtime/stalled-execution-detector.test.ts`
- `tests/integration/runtime/tight-loop-detector.test.ts`
- `tests/integration/runtime/worker-registry-service.test.ts`
- `tests/integration/security/startup-preflight.test.ts`

### core/security

- 源文件数：18
- 单元测试：26
- 集成测试：2
- 缺少直接覆盖：3

单元测试：
- `tests/unit/core/security/data-classification-service.test.ts`
- `tests/unit/core/security/env-secret-provider.test.ts`
- `tests/unit/core/security/file-freshness.test.ts`
- `tests/unit/core/security/network-egress-audit-types.test.ts`
- `tests/unit/core/security/network-egress-audit.test.ts`
- `tests/unit/core/security/network-egress-policy.test.ts`
- `tests/unit/core/security/outbound-url-policy.test.ts`
- `tests/unit/core/security/policy-engine.test.ts`
- `tests/unit/core/security/sandbox-policy-types.test.ts`
- `tests/unit/core/security/sandbox-policy.test.ts`
- `tests/unit/core/security/secret-management-support.test.ts`
- `tests/unit/security/audit-event-integrity.test.ts`
- `tests/unit/security/cve-intelligence-service.test.ts`
- `tests/unit/security/data-classification-service.test.ts`
- `tests/unit/security/env-secret-provider.test.ts`
- `tests/unit/security/external-secret-provider.test.ts`
- `tests/unit/security/file-freshness.test.ts`
- `tests/unit/security/managed-secret-provider-http.test.ts`
- `tests/unit/security/network-egress-audit.test.ts`
- `tests/unit/security/network-egress-policy.test.ts`
- `tests/unit/security/outbound-url-policy.test.ts`
- `tests/unit/security/policy-engine.test.ts`
- `tests/unit/security/sandbox-policy.test.ts`
- `tests/unit/security/secret-management-service.test.ts`
- `tests/unit/security/secret-management-support.test.ts`
- `tests/unit/security/trusted-context-scanner.test.ts`

集成测试：
- `tests/integration/security/audit-event-integrity.test.ts`
- `tests/integration/security/network-egress-audit-sandbox.test.ts`

缺少直接覆盖的源文件：
- `src/core/security/aws-kms-http-secret-provider.ts`
- `src/core/security/gcp-secret-manager-http-secret-provider.ts`
- `src/core/security/vault-http-secret-provider.ts`

### core/stability

- 源文件数：31
- 单元测试：28
- 集成测试：25
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/core/stability/stable-acceptance-line-types.test.ts`
- `tests/unit/core/stability/stable-release-gate.test.ts`
- `tests/unit/core/stability/vcr-replay-fixture-types.test.ts`
- `tests/unit/stability/stable-release-gate.test.ts`
- `tests/unit/testing/golden-task-runner.test.ts`
- `tests/unit/testing/stable-acceptance-line.test.ts`
- `tests/unit/testing/stable-backup-restore-rehearsal.test.ts`
- `tests/unit/testing/stable-evidence-bundle-support.test.ts`
- `tests/unit/testing/stable-evidence-sequence.test.ts`
- `tests/unit/testing/stable-gray-release-rehearsal.test.ts`
- `tests/unit/testing/stable-maintenance-rehearsal.test.ts`
- `tests/unit/testing/stable-prompt-injection-red-team.test.ts`
- `tests/unit/testing/stable-rollback-rehearsal.test.ts`
- `tests/unit/testing/stable-rolling-upgrade-rehearsal.test.ts`
- `tests/unit/testing/stable-runtime-soak-runner.test.ts`
- `tests/unit/testing/stable-runtime-validator.test.ts`
- `tests/unit/testing/vcr-replay-fixture.test.ts`

集成测试：
- `tests/integration/runtime/stable-backup-restore-rehearsal.test.ts`
- `tests/integration/runtime/stable-chaos-smoke.test.ts`
- `tests/integration/runtime/stable-concurrency-rehearsal.test.ts`
- `tests/integration/runtime/stable-cross-division-recovery-drill.test.ts`
- `tests/integration/runtime/stable-db-queue-disconnect-rehearsal.test.ts`
- `tests/integration/runtime/stable-db-writability-rehearsal.test.ts`
- `tests/integration/runtime/stable-dispatch-reconciliation-rehearsal.test.ts`
- `tests/integration/runtime/stable-dispatch-rehearsal.test.ts`
- `tests/integration/runtime/stable-event-replay-rehearsal.test.ts`
- `tests/integration/runtime/stable-evidence-bundle.test.ts`
- `tests/integration/runtime/stable-evidence-campaign.test.ts`
- `tests/integration/runtime/stable-evidence-sequence.test.ts`
- `tests/integration/runtime/stable-gray-release-rehearsal.test.ts`
- `tests/integration/runtime/stable-lease-rehearsal.test.ts`
- `tests/integration/runtime/stable-maintenance-rehearsal.test.ts`
- `tests/integration/runtime/stable-migration-compatibility-rehearsal.test.ts`
- `tests/integration/runtime/stable-prompt-injection-red-team.test.ts`
- `tests/integration/runtime/stable-queue-delivery-rehearsal.test.ts`
- `tests/integration/runtime/stable-release-gate.test.ts`
- `tests/integration/runtime/stable-release-package.test.ts`
- `tests/integration/runtime/stable-rollback-rehearsal.test.ts`
- `tests/integration/runtime/stable-rolling-upgrade-rehearsal.test.ts`
- `tests/integration/runtime/stable-worker-handshake-rehearsal.test.ts`
- `tests/integration/runtime/stable-worker-writeback-rehearsal.test.ts`
- `tests/integration/security/stable-maintenance-rehearsal.test.ts`

### core/storage

- 源文件数：80
- 单元测试：27
- 集成测试：2
- 缺少直接覆盖：64

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/core/storage/storage-backend-config.test.ts`
- `tests/unit/storage/phase1a-store-consistency.test.ts`
- `tests/unit/storage/phase1a-store-decorator.test.ts`
- `tests/unit/storage/phase1a-store-facade.test.ts`
- `tests/unit/storage/postgres/pg-database.test.ts`
- `tests/unit/storage/postgres/pg-schema.test.ts`
- `tests/unit/storage/runtime-lifecycle-repository.test.ts`
- `tests/unit/storage/session-dual-storage.test.ts`
- `tests/unit/storage/session-summary-autogen.test.ts`
- `tests/unit/storage/sqlite-database-facade.test.ts`
- `tests/unit/storage/sqlite-database.test.ts`
- `tests/unit/storage/sqlite-migration-compatibility.test.ts`
- `tests/unit/storage/sqlite-schema-compatibility-gate.test.ts`
- `tests/unit/storage/storage-backend-config.test.ts`
- `tests/unit/storage/storage-backend-factory.test.ts`
- `tests/unit/storage/storage-quota-service.test.ts`

集成测试：
- `tests/integration/security/storage-backend-factory.test.ts`
- `tests/integration/security/storage-quota-service.test.ts`

缺少直接覆盖的源文件：
- `src/core/storage/authoritative-sql-database.ts`
- `src/core/storage/authoritative-task-store.ts`
- `src/core/storage/postgres/pg-migrations-product.ts`
- `src/core/storage/postgres/pg-migrations-runtime.ts`
- `src/core/storage/postgres/pg-schema-support.ts`
- `src/core/storage/postgres/phase_1a_schema_ddl_part-1.ts`
- `src/core/storage/postgres/phase_1a_schema_ddl_part-2.ts`
- `src/core/storage/postgres/phase_1a_schema_ddl_part-3.ts`
- `src/core/storage/postgres/phase_1a_schema_ddl_part-4.ts`
- `src/core/storage/postgres/phase_1a_schema_ddl_part-5.ts`
- `src/core/storage/postgres/sqlite-database-wrapper.ts`
- `src/core/storage/repositories/authoritative-task-store-decorator.ts`
- `src/core/storage/sql/authoritative-schema.ts`
- `src/core/storage/sql/phase_1a_schema_sql_part-1.ts`
- `src/core/storage/sql/phase_1a_schema_sql_part-2.ts`
- `src/core/storage/sql/phase_1a_schema_sql_part-3.ts`
- `src/core/storage/sql/phase_1a_schema_sql_part-4.ts`
- `src/core/storage/sql/phase1a-schema.ts`
- `src/core/storage/sqlite/authoritative-task-store-compat.ts`
- `src/core/storage/sqlite/authoritative-task-store-core.ts`
- `src/core/storage/sqlite/authoritative-task-store-delegating-core.ts`
- `src/core/storage/sqlite/authoritative-task-store-facade.ts`
- `src/core/storage/sqlite/authoritative-task-store-legacy-compat.ts`
- `src/core/storage/sqlite/authoritative-task-store-types.ts`
- `src/core/storage/sqlite/phase1a-store.ts`
- `src/core/storage/sqlite/query-helper.ts`
- `src/core/storage/sqlite/repositories/approval-repository.ts`
- `src/core/storage/sqlite/repositories/artifact-repository.ts`
- `src/core/storage/sqlite/repositories/billing-repository.ts`
- `src/core/storage/sqlite/repositories/dispatch-repository.ts`
- `src/core/storage/sqlite/repositories/division-repository.ts`
- `src/core/storage/sqlite/repositories/event-repository.ts`
- `src/core/storage/sqlite/repositories/evolution-repository.ts`
- `src/core/storage/sqlite/repositories/execution-repository.ts`
- `src/core/storage/sqlite/repositories/intelligence-repository.ts`
- `src/core/storage/sqlite/repositories/lease-repository.ts`
- `src/core/storage/sqlite/repositories/lock-repository.ts`
- `src/core/storage/sqlite/repositories/marketplace-repository.ts`
- `src/core/storage/sqlite/repositories/memory-repository.ts`
- `src/core/storage/sqlite/repositories/operations-repository.ts`
- `src/core/storage/sqlite/repositories/organization-repository.ts`
- `src/core/storage/sqlite/repositories/release-repository.ts`
- `src/core/storage/sqlite/repositories/secret-repository.ts`
- `src/core/storage/sqlite/repositories/session-repository.ts`
- `src/core/storage/sqlite/repositories/task-repository.ts`
- `src/core/storage/sqlite/repositories/worker-repository.ts`
- `src/core/storage/sqlite/repositories/workflow-repository.ts`
- `src/core/storage/sqlite/sqlite-migration-plan.ts`
- `src/core/storage/sqlite/sqlite-migration-runtime-part1.ts`
- `src/core/storage/sqlite/sqlite-migration-runtime-part2.ts`
- `src/core/storage/sqlite/sqlite-migration-runtime-part3.ts`
- `src/core/storage/sqlite/sqlite-reliability-service.ts`

### core/tools

- 源文件数：36
- 单元测试：45
- 集成测试：4
- 缺少直接覆盖：3

单元测试：
- `tests/unit/core/tools/edit-replacement/edit-replacement-stage-support.test.ts`
- `tests/unit/core/tools/edit-replacement/match.test.ts`
- `tests/unit/core/tools/edit-replacement/string-utils.test.ts`
- `tests/unit/core/tools/patch-dsl-support.test.ts`
- `tests/unit/core/tools/question-tool.test.ts`
- `tests/unit/core/tools/skill-execution-support.test.ts`
- `tests/unit/core/tools/tool-argument-coercion.test.ts`
- `tests/unit/core/tools/tool-call-result.test.ts`
- `tests/unit/core/tools/tool-contract-validator.test.ts`
- `tests/unit/core/tools/tool-metadata-types.test.ts`
- `tests/unit/core/tools/tool-metadata.test.ts`
- `tests/unit/core/tools/tool-output-sanitizer.test.ts`
- `tests/unit/core/tools/tool-path-scope.test.ts`
- `tests/unit/core/tools/tool-recommend-service.test.ts`
- `tests/unit/tools/code-diagnostics-service.test.ts`
- `tests/unit/tools/command-executor.test.ts`
- `tests/unit/tools/command-security.test.ts`
- `tests/unit/tools/edit-replacement-service.test.ts`
- `tests/unit/tools/edit-replacement/apply.test.ts`
- `tests/unit/tools/edit-replacement/edit-replacement-result-support.test.ts`
- `tests/unit/tools/edit-replacement/match.test.ts`
- `tests/unit/tools/edit-replacement/string-utils.test.ts`
- `tests/unit/tools/edit-snapshot-service.test.ts`
- `tests/unit/tools/mcp-tool-guard.test.ts`
- `tests/unit/tools/patch-dsl-service.test.ts`
- `tests/unit/tools/patch-dsl-support.test.ts`
- `tests/unit/tools/question-tool.test.ts`
- `tests/unit/tools/role-tool-exposure-service.test.ts`
- `tests/unit/tools/semantic-repo-map-service.test.ts`
- `tests/unit/tools/shadow-snapshot-service.test.ts`
- `tests/unit/tools/skill-creator-service.test.ts`
- `tests/unit/tools/skill-execution-service.test.ts`
- `tests/unit/tools/skill-governance-service.test.ts`
- `tests/unit/tools/todo-write-tool.test.ts`
- `tests/unit/tools/tool-argument-coercion.test.ts`
- `tests/unit/tools/tool-call-result.test.ts`
- `tests/unit/tools/tool-contract-validator.test.ts`
- `tests/unit/tools/tool-execution-access.test.ts`
- `tests/unit/tools/tool-metadata.test.ts`
- `tests/unit/tools/tool-output-sanitizer.test.ts`
- `tests/unit/tools/tool-parallel-executor.test.ts`
- `tests/unit/tools/tool-path-scope.test.ts`
- `tests/unit/tools/tool-recommend-service.test.ts`
- `tests/unit/tools/web-fetch.test.ts`
- `tests/unit/tools/web-search.test.ts`

集成测试：
- `tests/integration/security/code-diagnostics-service.test.ts`
- `tests/integration/security/role-tool-exposure-service.test.ts`
- `tests/integration/security/skill-execution-service.test.ts`
- `tests/integration/tools/tool-metadata-integration.test.ts`

缺少直接覆盖的源文件：
- `src/core/tools/edit-replacement/edit-replacement-types.ts`
- `src/core/tools/skill-execution-cache-methods.ts`
- `src/core/tools/skill-execution-core-methods.ts`

### core/types

- 源文件数：20
- 单元测试：33
- 集成测试：1
- 缺少直接覆盖：1

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/evolution/evolution-types.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/product/billing-types.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/core/types/domain/billing-types.test.ts`
- `tests/unit/core/types/domain/core-types.test.ts`
- `tests/unit/core/types/domain/data-types.test.ts`
- `tests/unit/core/types/domain/dispatch-types.test.ts`
- `tests/unit/core/types/domain/evolution-types.test.ts`
- `tests/unit/core/types/domain/execution-types.test.ts`
- `tests/unit/core/types/domain/lease-types.test.ts`
- `tests/unit/core/types/domain/ops-types.test.ts`
- `tests/unit/core/types/domain/primitives.test.ts`
- `tests/unit/core/types/domain/secret-types.test.ts`
- `tests/unit/core/types/domain/session-types.test.ts`
- `tests/unit/core/types/domain/task-types.test.ts`
- `tests/unit/core/types/domain/worker-types.test.ts`
- `tests/unit/core/types/domain/workflow-types.test.ts`
- `tests/unit/core/types/domain/workspace-types.test.ts`
- `tests/unit/core/types/ids.test.ts`
- `tests/unit/core/types/status.test.ts`
- `tests/unit/types/domain-types.test.ts`
- `tests/unit/types/primitives.test.ts`
- `tests/unit/types/status.test.ts`

集成测试：
- `tests/integration/types/ids-integration.test.ts`

缺少直接覆盖的源文件：
- `src/core/types/domain/release-types.ts`

### core/utils

- 源文件数：2
- 单元测试：13
- 集成测试：1
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`
- `tests/unit/core/utils/bounded-cache.test.ts`
- `tests/unit/utils/bounded-cache.test.ts`

集成测试：
- `tests/integration/utils/bounded-cache-integration.test.ts`

### core/workflow

- 源文件数：4
- 单元测试：9
- 集成测试：1
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/workflow/minimal-workflow-types.test.ts`
- `tests/unit/core/workflow/output-schema-types.test.ts`
- `tests/unit/core/workflow/output-schema.test.ts`
- `tests/unit/core/workflow/workflow-step-retry-policy.test.ts`
- `tests/unit/core/workflow/workflow-validator.test.ts`
- `tests/unit/workflow/minimal-workflow.test.ts`
- `tests/unit/workflow/output-schema.test.ts`
- `tests/unit/workflow/workflow-step-retry-policy.test.ts`
- `tests/unit/workflow/workflow-validator.test.ts`

集成测试：
- `tests/integration/workflow/workflow-validator-integration.test.ts`

### gateway

- 源文件数：11
- 单元测试：11
- 集成测试：0
- 缺少直接覆盖：3

单元测试：
- `tests/unit/core/api/http-server/types.test.ts`
- `tests/unit/core/errors.test.ts`
- `tests/unit/gateway/channel-gateway-delivery-service.test.ts`
- `tests/unit/gateway/channel-gateway-retry-executor.test.ts`
- `tests/unit/gateway/channel-gateway-service.test.ts`
- `tests/unit/gateway/channel-gateway/errors.test.ts`
- `tests/unit/gateway/channel-gateway/helpers.test.ts`
- `tests/unit/gateway/gateway-target-directory-service.test.ts`
- `tests/unit/gateway/stream-bridge.test.ts`
- `tests/unit/gateway/stream/stream-bridge.test.ts`
- `tests/unit/gateway/targets/gateway-target-directory-service.test.ts`

缺少直接覆盖的源文件：
- `src/gateway/channel-gateway-delivery-support.ts`
- `src/gateway/storage-adapter.ts`
- `src/gateway/storage-port.ts`

### index.ts

- 源文件数：1
- 单元测试：11
- 集成测试：0
- 缺少直接覆盖：0

单元测试：
- `tests/unit/core/cache/index.test.ts`
- `tests/unit/core/compliance/index.test.ts`
- `tests/unit/core/constants/index.test.ts`
- `tests/unit/core/cost/index.test.ts`
- `tests/unit/core/deployment/index.test.ts`
- `tests/unit/core/memory/index.test.ts`
- `tests/unit/core/queue/index.test.ts`
- `tests/unit/core/runtime/dispatcher/index.test.ts`
- `tests/unit/core/runtime/orchestrator/index.test.ts`
- `tests/unit/core/runtime/planner/index.test.ts`
- `tests/unit/core/runtime/supervisor/index.test.ts`

## 4. 维护方式

- 当新增 `src` 模块或测试文件时，运行 `npm run test:matrix` 刷新本文档。
- 若某个模块故意只通过上层集成路径覆盖，请在代码评审或对应模块文档中说明原因。
