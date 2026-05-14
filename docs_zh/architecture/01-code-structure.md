# 新平台代码文件结构设计文档

> **文档版本**：v1.0
> **文档状态**：Draft
> **关联文档**：《企业级 Agent 平台总体技术架构设计文档》v2.7 §35 推荐代码目录
> **关联文档**：《老系统→新平台移植评估文档》v1.1
> **设计日期**：2026-04-19

---

## 一、文档目的

本文档定义新平台的**完整代码文件结构**，回答三个问题：

1. 新平台的 `src/` 目录如何组织？每个目录放什么？
2. 老系统（`src/core/` 42 个模块）的代码搬到新平台的哪个目录？
3. 新平台需要全新创建的 24 个模块放在哪里？

---

## 二、设计原则

| # | 原则 | 说明 |
|---|------|------|
| 1 | **架构驱动目录** | 顶层目录按七层架构 + 五平面划分，不按技术关注点（controller/service/repository）划分 |
| 2 | **有界上下文即目录** | 每个有界上下文（bounded context）对应一个二级目录，目录内自包含 model/service/repository/types |
| 3 | **契约集中** | 平面间通信契约集中在 `platform/contracts/`，不分散到各平面目录 |
| 4 | **域实例与框架分离** | `domains/` 下分"框架基础设施"和"域实例"两层，新增业务域只需添加域实例目录 |
| 5 | **测试镜像源码** | `tests/` 目录结构镜像 `src/`，路径一一对应 |
| 6 | **文件命名 kebab-case** | 文件名全部 kebab-case，类名/类型名 PascalCase，函数名 camelCase |
| 7 | **每目录一个 index.ts** | 每个二级目录提供 `index.ts` 作为公共 API 出口，三级目录为内部实现细节 |
| 8 | **零循环依赖** | 只允许上层依赖下层（Layer N 可依赖 Layer N-1），同层通过契约或事件解耦 |

---

## 三、顶层目录总览

> **当前实现说明（2026-05-14）**：`src/core/` 在新平台中只作为 Legacy 兼容与迁移重导出层保留，新的运行时、契约、执行、状态、治理能力以 `src/platform/*`、`src/domains/*`、`src/interaction/*`、`src/org-governance/*`、`src/scale-ecosystem/*`、`src/ops-maturity/*` 为权威实现位置。新增代码不得再把 `src/core/` 当作新能力入口。

```
new-platform/
├── src/
│   ├── platform/           # Layer 1-2：基础设施层 + AI 运营层（五平面 + 横切）
│   ├── domains/            # Layer 3：业务域接入层
│   ├── interaction/        # Layer 4：智能交互层
│   ├── org-governance/     # Layer 5：组织治理层
│   ├── scale-ecosystem/    # Layer 6：规模化运行层 + 生态层
│   ├── ops-maturity/       # Layer 7：运营成熟度层
│   ├── plugins/            # 跨层：插件生态
│   ├── sdk/                # 跨层：SDK 与开发者体验
│   ├── apps/               # 应用入口（API server / Console / Workers）
│   └── index.ts            # 平台入口
├── tests/                  # 测试（镜像 src/ 结构）
├── config/                 # 版本化配置
├── divisions/              # Division 定义（迁移后适配 DomainDescriptor）
├── docs_zh/                # 中文文档
├── docs_en/                # 英文文档
├── scripts/                # CI/构建脚本
├── deploy/                 # 部署清单
└── [顶层配置文件]           # package.json / tsconfig.json / eslint.config.js / Dockerfile / ...
```

### 3.1 老系统 vs 新平台顶层对比

| 老系统 | 新平台 | 变化说明 |
|--------|--------|---------|
| `src/core/` (42 个扁平模块) | `src/platform/` + `src/domains/` + `src/interaction/` + `src/org-governance/` + `src/scale-ecosystem/` + `src/ops-maturity/` | 扁平 core/ 拆分为按七层架构组织的 6 个顶层目录 |
| `src/cli/` (78 个脚本) | `src/sdk/cli/` | CLI 归入 SDK 层 |
| `src/gateway/` (13 文件) | `src/platform/interface/` + `src/interaction/nl-gateway/` | API gateway 归入 P1 Interface，NL gateway 归入 Layer 4 |
| `src/plugins/` (20 文件) | `src/plugins/` | 保持独立，结构不变 |
| `src/index.ts` | `src/index.ts` | 保持 |

### 3.2 老系统 42 模块 → 新平台目录映射速查表

| 老模块 | 新目录 | 架构层 |
|--------|--------|--------|
| `core/types/` | `platform/contracts/types/` | 跨层契约 |
| `core/errors.ts` | `platform/contracts/errors.ts` | 跨层契约 |
| `core/constants/` | `platform/contracts/constants/` | 跨层契约 |
| `core/results/` | `platform/contracts/result-envelope/` | 跨层契约 |
| `core/utils/` | `platform/shared/utils/` | 跨层共享 |
| `core/lifecycle/` | `platform/shared/lifecycle/` | 跨层共享 |
| `core/config/` | `platform/control-plane/config-center/` | P2 控制平面 |
| `core/storage/` | `platform/state-evidence/truth/` | P5 状态与证据 |
| `core/events/` | `platform/state-evidence/events/` | P5 状态与证据 |
| `core/locking/` | `platform/execution/distributed-lock/` | P4 执行平面 |
| `core/queue/` | `platform/execution/queue/` | P4 执行平面 |
| `core/cache/` | `platform/shared/cache/` | 跨层共享 |
| `core/api/` | `platform/interface/api/` | P1 接口平面 |
| `core/resource/` | `platform/execution/resource/` | P4 执行平面 |
| `core/runtime/` → Dispatch | `platform/execution/dispatcher/` | P4 执行平面 |
| `core/runtime/` → Lease | `platform/execution/lease/` | P4 执行平面 |
| `core/runtime/` → Worker | `platform/execution/worker-pool/` | P4 执行平面 |
| `core/runtime/` → HA | `platform/execution/ha/` | P4 执行平面 |
| `core/runtime/` → Recovery | `platform/execution/recovery/` | P4 执行平面 |
| `core/runtime/` → HotUpgrade | `platform/execution/hot-upgrade/` | P4 执行平面 |
| `core/runtime/` → StateMachine | `platform/execution/state-transition/` | P4 执行平面 |
| `core/runtime/` → AgentExec | `platform/execution/execution-engine/` | P4 执行平面 |
| `core/runtime/` → HITL | `platform/orchestration/hitl/` | P3 编排平面 |
| `core/runtime/` → Orchestration | `platform/orchestration/routing/` | P3 编排平面 |
| `core/agent-loop/` | `platform/orchestration/oapeflir/` | P3 编排平面 |
| `core/planning/` | `platform/orchestration/planner/` | P3 编排平面 |
| `core/orchestration/` | `platform/orchestration/routing/` | P3 编排平面 |
| `core/providers/` | `platform/model-gateway/provider-registry/` | AI 运营 |
| `core/tools/` | `platform/execution/tool-executor/` | P4 执行平面 |
| `core/workflow/` | `platform/orchestration/oapeflir/workflow/` | P3 编排平面 |
| `core/artifacts/` | `platform/state-evidence/artifacts/` | P5 状态与证据 |
| `core/feedback/` | `scale-ecosystem/feedback-loop/` | Layer 6 |
| `core/learning/` | `platform/orchestration/oapeflir/learn/` | P3 编排平面 |
| `core/evaluation/` | `platform/prompt-engine/eval/` | AI 运营 |
| `core/memory/` | `platform/state-evidence/memory/` | P5 状态与证据 |
| `core/knowledge/` | `platform/state-evidence/knowledge/` | P5 状态与证据 |
| `core/messages/` | `platform/model-gateway/messages/` | AI 运营 |
| `core/domain-registry/` | `domains/registry/` | Layer 3 |
| `core/divisions/` | `domains/governance/` | Layer 3 |
| `core/security/` | `platform/control-plane/iam/` | P2 控制平面 |
| `core/approvals/` | `platform/control-plane/approval-center/` | P2 控制平面 |
| `core/compliance/` | `platform/compliance/` | AI 运营 |
| `core/cost/` | `platform/model-gateway/cost-tracker/` | AI 运营 |
| `core/hr/` | `org-governance/org-model/` | Layer 5 |
| `core/deployment/` | `platform/control-plane/rollout-controller/` | P2 控制平面 |
| `core/improvement/` | `platform/orchestration/oapeflir/improve-rollout/` | P3 编排平面 |
| `core/observability/` | `platform/shared/observability/` | 跨层共享 |
| `core/ops/` | `platform/control-plane/incident-control/` | P2 控制平面 |
| `core/stability/` | `platform/shared/stability/` | 跨层共享 |
| `core/evolution/` | `ops-maturity/drift-detection/` | Layer 7 |
| `core/reliability/` | `platform/execution/recovery/` | P4 执行平面 |
| `core/product/` | `scale-ecosystem/marketplace/` | Layer 6 |
| `gateway/` | `platform/interface/` (拆分) | P1 接口平面 |
| `plugins/` | `plugins/` | 跨层 |
| `cli/` | `sdk/cli/` | 跨层 SDK |

---

## 四、platform/ — 基础设施层 + AI 运营层

`platform/` 对应架构 Layer 1（基础设施）和 Layer 2（AI 运营），包含五平面 + 横切关注点。

```
src/platform/
├── interface/              # P1 接口平面 ── §6 API 契约
│   ├── api/                #   HTTP API server + OIDC/OAuth + WebSocket
│   │   ├── http-api-server.ts
│   │   ├── api-auth-service.ts
│   │   ├── oidc-oauth-service.ts
│   │   ├── openapi-document.ts
│   │   ├── mission-control-service.ts
│   │   ├── task-websocket-status-relay.ts
│   │   └── index.ts
│   ├── webhook/            #   Webhook 入站处理
│   │   └── index.ts
│   ├── channel-gateway/    #   渠道网关（Telegram/Slack/Webhook/SSE）
│   │   ├── channel-gateway-service.ts
│   │   ├── channel-gateway-delivery-service.ts
│   │   ├── channel-gateway-delivery-support.ts
│   │   ├── channel-gateway-retry-executor.ts
│   │   ├── storage-adapter.ts
│   │   ├── storage-port.ts
│   │   ├── websocket-bridge.ts
│   │   ├── stream-bridge.ts
│   │   ├── gateway-target-directory-service.ts
│   │   ├── errors.ts
│   │   ├── helpers.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── scheduler/          #   定时调度入口（§41 主动式 Agent 触发）
│   │   └── index.ts
│   ├── console-backend/    #   Console UI 后端（§43 看板/§44 UX）
│   │   └── index.ts
│   └── ingress/            #   入口流量治理（限流/路由/灰度）
│       └── index.ts
│
├── control-plane/          # P2 控制平面 ── §24 配置 / §11 安全 / §21 审批
│   ├── tenant/             #   租户管理
│   │   └── index.ts
│   ├── iam/                #   身份与访问管理（← core/security/）
│   │   ├── sandbox-policy.ts
│   │   ├── policy-engine.ts
│   │   ├── field-encryption.ts
│   │   ├── data-classification-service.ts
│   │   ├── audit-event-integrity.ts
│   │   ├── trusted-context-scanner.ts
│   │   ├── cve-intelligence-service.ts
│   │   ├── secret-management-service.ts
│   │   ├── secret-management-support.ts
│   │   ├── env-secret-provider.ts
│   │   ├── external-secret-provider.ts
│   │   ├── managed-secret-provider.ts
│   │   ├── vault-http-secret-provider.ts
│   │   ├── aws-kms-http-secret-provider.ts
│   │   ├── gcp-secret-manager-http-secret-provider.ts
│   │   ├── network-egress-policy.ts
│   │   ├── network-egress-audit.ts
│   │   ├── outbound-url-policy.ts
│   │   ├── file-freshness.ts
│   │   └── index.ts
│   ├── policy-center/      #   策略中心（风险等级/安全策略/合规策略集中管理）
│   │   └── index.ts
│   ├── approval-center/    #   审批中心（← core/approvals/）
│   │   ├── approval-service.ts
│   │   ├── approval-timeout-executor.ts
│   │   └── index.ts
│   ├── rollout-controller/  #   发布控制器（← core/deployment/）
│   │   ├── traffic-routing-service.ts
│   │   └── index.ts
│   ├── incident-control/    #   事件/运维控制（← core/ops/）
│   │   ├── doctor-service.ts
│   │   ├── deployment-execution-service.ts
│   │   ├── environment-deployment-service.ts
│   │   ├── human-takeover-service.ts
│   │   ├── human-takeover-service-async.ts
│   │   ├── human-takeover-support.ts
│   │   ├── acceptance-readiness-service.ts
│   │   ├── operations-governance-service.ts
│   │   ├── enterprise-governance-service.ts
│   │   ├── enterprise-governance-schema.ts
│   │   ├── enterprise-governance-support.ts
│   │   ├── industrial-ops-program-service.ts
│   │   ├── release-pipeline-service.ts
│   │   ├── release-pipeline-support.ts
│   │   ├── auto-stop-loss-service.ts
│   │   ├── runtime-version-snapshot.ts
│   │   ├── workflow-dispatch-receipt.ts
│   │   ├── tenant-execution-isolation-service.ts
│   │   └── index.ts
│   ├── replay-repair-control/ #  重放/修复控制
│   │   └── index.ts
│   ├── config-center/       #   配置治理中心（← core/config/）
│   │   ├── runtime-env.ts
│   │   ├── api-server-env.ts
│   │   ├── gateway-env.ts
│   │   ├── channel-gateway-env.ts
│   │   ├── postgres-pool-env.ts
│   │   ├── billing-env.ts
│   │   ├── startup-env-schema.ts
│   │   ├── provider-defaults.ts
│   │   ├── model-metadata-registry.ts
│   │   ├── billing-plan-catalog.ts
│   │   ├── resource-ceiling.ts
│   │   ├── profile-home.ts
│   │   ├── config-governance-service.ts
│   │   ├── config-governance-support.ts
│   │   ├── config-override-governance.ts
│   │   ├── protected-governance-integrity-service.ts
│   │   └── index.ts
│   └── audit-export/        #   审计导出（← core/compliance/）
│       ├── audit-export-service.ts
│       └── index.ts
│
├── orchestration/          # P3 编排平面 ── §13 OAPEFLIR
│   ├── oapeflir/           #   OAPEFLIR 受控认知内核（← core/agent-loop/ + core/workflow/）
│   │   ├── oapeflir-loop-service.ts
│   │   ├── execute-bridge.ts
│   │   ├── runtime-execute-bridge.ts
│   │   ├── assessment-service.ts
│   │   ├── handoff-builder.ts
│   │   ├── handoff-model.ts
│   │   ├── handoff-serializer.ts
│   │   ├── stage-timeline.ts
│   │   ├── final-response.ts
│   │   ├── tool-call-record.ts
│   │   ├── dto.ts
│   │   ├── ref-types.ts
│   │   ├── kv-cache-prefix-config.ts
│   │   ├── workflow/       #     Workflow 子模块（← core/workflow/）
│   │   │   ├── minimal-workflow.ts
│   │   │   ├── workflow-validator.ts
│   │   │   ├── workflow-step-retry-policy.ts
│   │   │   ├── output-schema.ts
│   │   │   └── index.ts
│   │   ├── learn/          #     Learn 阶段（← core/learning/）
│   │   │   ├── strategy-learning-service.ts
│   │   │   ├── experience-distillation-service.ts
│   │   │   ├── failure-pattern-miner.ts
│   │   │   ├── knowledge-promotion-service.ts
│   │   │   ├── learning-object-model.ts
│   │   │   ├── learning-object-validator.ts
│   │   │   ├── learning-artifact-model.ts
│   │   │   └── index.ts
│   │   ├── improve-rollout/ #    Improve/Rollout 阶段（← core/improvement/）
│   │   │   ├── policy-rollout-service.ts
│   │   │   ├── release-policy.ts
│   │   │   ├── strategy-versioning.ts
│   │   │   ├── guardrail-evaluator.ts
│   │   │   ├── canary-traffic-router.ts
│   │   │   ├── auto-rollback-service.ts
│   │   │   ├── autonomy-boundary-policy.ts
│   │   │   ├── improvement-candidate-registry.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── planner/            #   计划引擎（← core/planning/）
│   │   ├── plan-model.ts
│   │   ├── plan-builder.ts
│   │   ├── plan-evaluator.ts
│   │   ├── plan-repository.ts
│   │   ├── plan-dag-validator.ts
│   │   ├── plan-strategy-selector.ts
│   │   ├── task-decomposition-service.ts
│   │   ├── replanning-service.ts
│   │   └── index.ts
│   ├── replan/             #   重规划
│   │   └── index.ts
│   ├── routing/            #   路由与编排（← core/orchestration/）
│   │   ├── intake-router.ts
│   │   ├── workflow-planner.ts
│   │   ├── agent-team-service.ts
│   │   └── index.ts
│   ├── escalation/         #   升级处理
│   │   └── index.ts
│   └── hitl/               #   人机协作（← runtime/HITL BC）
│       ├── hitl-explainability-service.ts
│       └── index.ts
│
├── execution/              # P4 执行平面 ── §14 Runtime
│   ├── dispatcher/         #   执行调度（← runtime/BC1 Dispatch）
│   │   ├── execution-dispatch-service.ts
│   │   ├── execution-dispatch-service-async.ts
│   │   ├── execution-dispatch-support.ts
│   │   ├── execution-dispatch-reconciliation-service.ts
│   │   ├── admission-controller.ts
│   │   ├── execution-priority-preemption-service.ts
│   │   ├── execution-priority-preemption-service-async.ts
│   │   ├── execution-resource-ceiling-guard.ts
│   │   ├── execution-resource-monitor.ts
│   │   ├── execution-deviation-detector.ts
│   │   └── index.ts
│   ├── lease/              #   租约管理（← runtime/BC2 Lease）
│   │   ├── execution-lease-service.ts
│   │   ├── lease-repository.ts
│   │   ├── lease-repository-sqlite.ts
│   │   ├── lease-repository-postgres.ts
│   │   └── index.ts
│   ├── worker-pool/        #   工作者管理（← runtime/BC3 Worker）
│   │   ├── worker-registry-service.ts
│   │   ├── worker-load-balancing.ts
│   │   ├── worker-scheduling-status.ts
│   │   ├── remote-worker-registration-service.ts
│   │   ├── remote-session-guard.ts
│   │   ├── execution-worker-handshake-service.ts
│   │   ├── execution-worker-handshake-service-async.ts
│   │   ├── execution-worker-handshake-support.ts
│   │   ├── execution-worker-handshake-types.ts
│   │   ├── execution-worker-writeback-service.ts
│   │   ├── execution-worker-writeback-service-async.ts
│   │   ├── execution-worker-writeback-support.ts
│   │   └── index.ts
│   ├── execution-engine/   #   Agent 执行引擎（← runtime/BC9）
│   │   ├── agent-executor.ts
│   │   ├── runtime-factory.ts
│   │   ├── runtime-context.ts
│   │   ├── single-task-execution.ts
│   │   ├── single-task-happy-path.ts
│   │   ├── phase1a-happy-path.ts
│   │   ├── phase1b-orchestration.ts
│   │   ├── multi-step-orchestration.ts
│   │   ├── model-call-provider.ts
│   │   ├── call-governance.ts
│   │   ├── complexity-router.ts
│   │   ├── loop-detection.ts
│   │   ├── tight-loop-detector.ts
│   │   ├── effect-buffer.ts
│   │   ├── context-compaction-service.ts
│   │   ├── prompt-partition-cache.ts
│   │   ├── output-continuation-service.ts
│   │   ├── session-lifecycle.ts
│   │   ├── middleware-init.ts
│   │   ├── agent-middleware-chain.ts
│   │   └── index.ts
│   ├── state-transition/   #   状态机（← runtime/BC8）
│   │   ├── state-transition-machine.ts
│   │   ├── transition-service.ts
│   │   └── index.ts
│   ├── ha/                 #   高可用协调（← runtime/BC5 HA）
│   │   ├── ha-coordinator-service.ts
│   │   ├── ha-repository.ts
│   │   ├── ha-repository-sqlite.ts
│   │   ├── ha-repository-postgres.ts
│   │   ├── coordinator-load-balancing-service.ts
│   │   ├── control-plane-load-balancing-schema.ts
│   │   ├── cross-region-deployment-service.ts
│   │   └── index.ts
│   ├── hot-upgrade/        #   热升级（← runtime/BC6）
│   │   ├── hot-upgrade-service.ts
│   │   ├── hot-upgrade-service-async.ts
│   │   ├── hot-upgrade-factory.ts
│   │   ├── hot-upgrade-repository.ts
│   │   ├── hot-upgrade-repository-sqlite.ts
│   │   ├── hot-upgrade-repository-postgres.ts
│   │   └── index.ts
│   ├── recovery/           #   恢复与修复（← runtime/BC7 + core/reliability/）
│   │   ├── runtime-recovery-service.ts
│   │   ├── runtime-recovery-decision-service.ts
│   │   ├── runtime-recovery-replay-service.ts
│   │   ├── runtime-repair-service.ts
│   │   ├── stalled-execution-detector.ts
│   │   ├── stalled-execution-escalation-service.ts
│   │   ├── validation-repair-loop.ts
│   │   ├── execution-db-queue-disconnect-repair-service.ts
│   │   ├── failure-classification.ts
│   │   ├── repair-pipeline.ts
│   │   ├── task-card.ts
│   │   ├── validation-report.ts
│   │   ├── review-report.ts
│   │   ├── release-record.ts
│   │   ├── patch-bundle.ts
│   │   └── index.ts
│   ├── tool-executor/      #   工具执行器（← core/tools/）
│   │   ├── command-executor.ts
│   │   ├── command-security.ts
│   │   ├── question-tool.ts
│   │   ├── todo-write-tool.ts
│   │   ├── web-fetch.ts
│   │   ├── web-search.ts
│   │   ├── tool-metadata.ts
│   │   ├── tool-call-result.ts
│   │   ├── tool-parallel-executor.ts
│   │   ├── tool-argument-coercion.ts
│   │   ├── tool-contract-validator.ts
│   │   ├── tool-execution-access.ts
│   │   ├── tool-output-sanitizer.ts
│   │   ├── tool-path-scope.ts
│   │   ├── tool-recommend-service.ts
│   │   ├── skill-execution-service.ts
│   │   ├── skill-execution-core-methods.ts
│   │   ├── skill-execution-cache-methods.ts
│   │   ├── skill-execution-support.ts
│   │   ├── skill-governance-service.ts
│   │   ├── skill-creator-service.ts
│   │   ├── role-tool-exposure-service.ts
│   │   ├── semantic-repo-map-service.ts
│   │   ├── edit-replacement-service.ts
│   │   ├── edit-snapshot-service.ts
│   │   ├── shadow-snapshot-service.ts
│   │   ├── patch-dsl-service.ts
│   │   ├── patch-dsl-support.ts
│   │   ├── code-diagnostics-service.ts
│   │   ├── mcp-tool-guard.ts
│   │   └── index.ts
│   ├── plugin-executor/    #   插件执行器（运行时沙箱）
│   │   └── index.ts
│   ├── distributed-lock/   #   分布式锁（← core/locking/）
│   │   ├── distributed-lock-service.ts
│   │   ├── distributed-lock-factory.ts
│   │   ├── distributed-lock-types.ts
│   │   ├── locking-support.ts
│   │   ├── sqlite-lock-adapter.ts
│   │   ├── pg-advisory-lock-adapter.ts
│   │   ├── redis-lock-adapter.ts
│   │   └── index.ts
│   ├── queue/              #   消息队列（← core/queue/）
│   │   ├── queue-adapter.ts
│   │   ├── queue-adapter-types.ts
│   │   ├── queue-adapter-factory.ts
│   │   ├── sqlite-queue-adapter.ts
│   │   ├── redis-queue-adapter.ts
│   │   └── index.ts
│   ├── resource/           #   资源追踪（← core/resource/）
│   │   ├── process-tracker.ts
│   │   └── index.ts
│   └── startup/            #   启动与预检
│       ├── startup-preflight.ts
│       ├── startup-consistency-checker.ts
│       ├── graceful-shutdown.ts
│       └── index.ts
│
├── state-evidence/         # P5 状态与证据平面 ── §25-§29
│   ├── truth/              #   权威数据存储（← core/storage/ 拆分后）
│   │   ├── sqlite-database.ts
│   │   ├── async-sql-database.ts
│   │   ├── authoritative-sql-database.ts
│   │   ├── storage-backend-factory.ts
│   │   ├── storage-backend-config.ts
│   │   ├── storage-quota-service.ts
│   │   ├── session-dual-storage.ts
│   │   ├── phase1a-store.ts
│   │   ├── migration-runner.ts
│   │   ├── async-repository-registry.ts
│   │   ├── async-query-helper.ts
│   │   ├── repositories/   #     按有界上下文拆分的 Repository（§九拆分产物）
│   │   │   ├── task-repository.ts
│   │   │   ├── workflow-repository.ts
│   │   │   ├── execution-repository.ts
│   │   │   ├── session-repository.ts
│   │   │   ├── worker-repository.ts
│   │   │   ├── dispatch-repository.ts
│   │   │   ├── lease-repository.ts
│   │   │   ├── lock-repository.ts
│   │   │   ├── event-repository.ts
│   │   │   ├── approval-repository.ts
│   │   │   ├── billing-repository.ts
│   │   │   ├── memory-repository.ts
│   │   │   ├── artifact-repository.ts
│   │   │   ├── division-repository.ts
│   │   │   ├── secret-repository.ts
│   │   │   ├── marketplace-repository.ts
│   │   │   ├── release-repository.ts
│   │   │   ├── organization-repository.ts
│   │   │   ├── intelligence-repository.ts
│   │   │   ├── evolution-repository.ts
│   │   │   ├── operations-repository.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── events/             #   事件总线（← core/events/）
│   │   ├── typed-event-bus.ts
│   │   ├── typed-event-publisher.ts
│   │   ├── typed-event-payloads.ts
│   │   ├── event-types.ts
│   │   ├── event-registry.ts
│   │   ├── event-ops-service.ts
│   │   ├── durable-event-bus.ts
│   │   ├── durable-event-bus-async.ts
│   │   └── index.ts
│   ├── projections/        #   投影视图
│   │   └── index.ts
│   ├── artifacts/          #   Artifact 管理（← core/artifacts/）
│   │   ├── artifact-store.ts
│   │   ├── artifact-model.ts
│   │   ├── artifact-resolver.ts
│   │   ├── artifact-versioning.ts
│   │   ├── artifact-linkage.ts
│   │   ├── artifact-publish-service.ts
│   │   ├── artifact-publish-ledger.ts
│   │   ├── artifact-preview-service.ts
│   │   ├── artifact-bundle-service.ts
│   │   ├── artifact-plane-service.ts
│   │   ├── artifact-governance-service.ts
│   │   ├── sensitive-content-scanner.ts
│   │   └── index.ts
│   ├── memory/             #   记忆管理（← core/memory/）
│   │   ├── memory-service.ts
│   │   ├── memory-provider.ts
│   │   ├── builtin-memory-provider.ts
│   │   ├── memory-retrieval-service.ts
│   │   ├── memory-consolidation.ts
│   │   ├── memory-promotion-engine.ts
│   │   ├── memory-quality.ts
│   │   ├── memory-plane-service.ts
│   │   ├── memory-schema.ts
│   │   ├── memory-write-request.ts
│   │   ├── memory-layer-model.ts
│   │   ├── user-memory-store.ts
│   │   ├── project-memory-store.ts
│   │   ├── session-summary-service.ts
│   │   ├── experience-cache-service.ts
│   │   └── index.ts
│   ├── knowledge/          #   知识平面（← core/knowledge/）
│   │   ├── knowledge-model.ts
│   │   ├── knowledge-query-service.ts
│   │   ├── knowledge-ingestion-pipeline.ts
│   │   ├── knowledge-plane-service.ts
│   │   ├── semantic-knowledge-graph.ts
│   │   ├── semantic-embedding.ts
│   │   ├── semantic-vector-store.ts
│   │   ├── semantic-vector-validation.ts
│   │   ├── keyword-index.ts
│   │   └── index.ts
│   ├── audit/              #   审计日志
│   │   └── index.ts
│   ├── incident/           #   事故记录
│   │   └── index.ts
│   ├── checkpoints/        #   检查点
│   │   ├── workflow-step-checkpoint.ts
│   │   └── index.ts
│   └── dlq/                #   死信队列
│       └── index.ts
│
├── model-gateway/          # AI 运营：LLM 抽象层 ── §15
│   ├── provider-registry/  #   Provider 注册与管理（← core/providers/）
│   │   ├── base-chat-provider.ts
│   │   ├── unified-chat-provider.ts
│   │   ├── circuit-breaker.ts
│   │   ├── model-routing-service.ts
│   │   ├── provider-credential-pool.ts
│   │   ├── provider-credential-pool-support.ts
│   │   └── index.ts
│   ├── router/             #   模型路由（cost/latency/capability 多维路由）
│   │   └── index.ts
│   ├── cache/              #   KV Cache / Prompt Cache
│   │   └── index.ts
│   ├── cost-tracker/       #   Token 计量与成本追踪（← core/cost/）
│   │   ├── budget-guard.ts
│   │   └── index.ts
│   ├── fallback/           #   Provider 故障切换
│   │   └── index.ts
│   └── messages/           #   消息模型（← core/messages/）
│       ├── token-estimator.ts
│       ├── message-parts.ts
│       └── index.ts
│
├── prompt-engine/          # AI 运营：Prompt 管理 ── §16-§17
│   ├── registry/           #   Prompt 版本注册
│   │   └── index.ts
│   ├── renderer/           #   Prompt 渲染
│   │   └── index.ts
│   ├── rollout/            #   Prompt 灰度发布
│   │   └── index.ts
│   └── eval/               #   模型评估（← core/evaluation/）
│       ├── llm-eval-service.ts
│       ├── execution-outcome-evaluator.ts
│       ├── post-execution-quality-gate.ts
│       ├── prompt-model-policy-governance-service.ts
│       ├── prompt-model-policy-governance-schema.ts
│       └── index.ts
│
├── compliance/             # AI 运营：合规与数据治理 ── §23
│   ├── erasure/            #   数据删除（crypto-shredding）
│   │   └── index.ts
│   ├── encryption/         #   字段级加密
│   │   └── index.ts
│   ├── data-residency/     #   数据驻留（跨境合规）
│   │   └── index.ts
│   └── lineage/            #   数据血缘
│       └── index.ts
│
├── contracts/              # 跨平面契约 ── §5
│   ├── types/              #   领域类型（← core/types/）
│   │   ├── domain.ts
│   │   ├── ids.ts
│   │   ├── status.ts
│   │   └── index.ts
│   ├── errors.ts           #   错误体系（← core/errors.ts）
│   ├── constants/          #   全局常量（← core/constants/）
│   │   ├── time.ts
│   │   └── index.ts
│   ├── result-envelope/    #   Result 模式（← core/results/）
│   │   ├── result-envelope.ts
│   │   └── index.ts
│   ├── request-envelope/   #   请求信封（§5.3）
│   │   └── index.ts
│   ├── control-directive/  #   控制指令（§5.4）
│   │   └── index.ts
│   ├── execution-plan/     #   执行计划（§5.5）
│   │   └── index.ts
│   ├── execution-receipt/  #   执行回执（§5.6）
│   │   └── index.ts
│   ├── state-command/      #   状态命令（§5.7）
│   │   └── index.ts
│   ├── delegation-request/ #   委托请求（§19）
│   │   └── index.ts
│   └── model-request/      #   模型请求（§15）
│       └── index.ts
│
└── shared/                 # 跨平面共享基础设施
    ├── utils/              #   工具类（← core/utils/）
    │   ├── bounded-cache.ts
    │   └── index.ts
    ├── lifecycle/          #   服务生命周期（← core/lifecycle/）
    │   ├── service-registry.ts
    │   ├── evolution-mvp-service.ts
    │   └── index.ts
    ├── cache/              #   多级缓存（← core/cache/）
    │   ├── cache-facade.ts
    │   ├── cache-bootstrap.ts
    │   ├── cache-policy.ts
    │   ├── cache-invalidation.ts
    │   ├── cache-invalidation-broadcast.ts
    │   ├── cache-key-factory.ts
    │   ├── cache-metrics.ts
    │   ├── cache-normalizer.ts
    │   ├── cache-orchestration-service.ts
    │   ├── cache-types.ts
    │   ├── cache-errors.ts
    │   └── index.ts
    ├── observability/      #   可观测性（← core/observability/）
    │   ├── structured-logger.ts
    │   ├── log-transport.ts
    │   ├── log-transport-bootstrap.ts
    │   ├── otel-bootstrap.ts
    │   ├── otel-tracer.ts
    │   ├── trace-context.ts
    │   ├── metrics-service.ts
    │   ├── metrics-server.ts
    │   ├── runtime-metrics-registry.ts
    │   ├── prometheus-metrics-exporter.ts
    │   ├── health-service.ts
    │   ├── diagnostics-service.ts
    │   ├── diagnostics-support.ts
    │   ├── diagnostics-export-service.ts
    │   ├── inspect-service.ts
    │   ├── inspect-service-support.ts
    │   ├── task-board-service.ts
    │   ├── task-timeline-service.ts
    │   ├── task-situation-report-service.ts
    │   ├── task-situation-builder.ts
    │   ├── system-situation-model.ts
    │   ├── system-situation-builder.ts
    │   ├── observation-aggregator.ts
    │   ├── sli-collection-service.ts
    │   ├── slo-alerting-service.ts
    │   ├── anomaly-detection-service.ts
    │   ├── observability-retention-service.ts
    │   ├── provider-health-tracker.ts
    │   ├── agent-state-view-service.ts
    │   └── index.ts
    └── stability/          #   稳定性排练（← core/stability/）
        ├── golden-task-runner.ts
        ├── vcr-replay-fixture.ts
        ├── stable-acceptance-line.ts
        ├── stable-runtime-validator.ts
        ├── stable-release-gate.ts
        ├── stable-release-package.ts
        ├── stable-evidence-bundle.ts
        ├── stable-evidence-bundle-support.ts
        ├── stable-evidence-sequence.ts
        ├── stable-evidence-campaign.ts
        ├── stable-dispatch-rehearsal.ts
        ├── stable-dispatch-reconciliation-rehearsal.ts
        ├── stable-worker-handshake-rehearsal.ts
        ├── stable-worker-writeback-rehearsal.ts
        ├── stable-lease-rehearsal.ts
        ├── stable-concurrency-rehearsal.ts
        ├── stable-queue-delivery-rehearsal.ts
        ├── stable-event-replay-rehearsal.ts
        ├── stable-chaos-smoke.ts
        ├── stable-prompt-injection-red-team.ts
        ├── stable-rolling-upgrade-rehearsal.ts
        ├── stable-rollback-rehearsal.ts
        ├── stable-backup-restore-rehearsal.ts
        ├── stable-maintenance-rehearsal.ts
        ├── stable-gray-release-rehearsal.ts
        ├── stable-db-writability-rehearsal.ts
        ├── stable-db-queue-disconnect-rehearsal.ts
        ├── stable-migration-compatibility-rehearsal.ts
        ├── stable-runtime-soak-runner.ts
        ├── stable-cross-division-recovery-drill.ts
        └── index.ts
```

### 4.1 platform/ 统计

| 子目录 | 架构定位 | 迁移来源文件数 | 新建文件数 |
|--------|---------|-------------|-----------|
| `interface/` | P1 接口平面 | ~43（api 30 + gateway 13） | ~5 |
| `control-plane/` | P2 控制平面 | ~72（config 27 + security 19 + approvals 3 + ops 19 + deployment 2 + compliance 2） | ~8 |
| `orchestration/` | P3 编排平面 | ~64（agent-loop 14 + planning 9 + orchestration 3 + workflow 4 + learning 14 + improvement 11 + runtime/HITL 2 + runtime/orchestration 7） | ~3 |
| `execution/` | P4 执行平面 | ~155（runtime 80 + tools 36 + locking 8 + queue 6 + resource 2 + reliability 8 + 启动 3） | ~5 |
| `state-evidence/` | P5 状态与证据 | ~157（storage 101 + events 8 + artifacts 13 + memory 16 + knowledge 10 + 拆分 repo 21） | ~8 |
| `model-gateway/` | AI 运营 | ~12（providers 10 + messages 2） | ~5 |
| `prompt-engine/` | AI 运营 | ~6（evaluation 6） | ~5 |
| `compliance/` | AI 运营 | 0 | ~6 |
| `contracts/` | 跨平面 | ~26（types 21 + errors 1 + constants 2 + results 2） | ~8 |
| `shared/` | 跨层共享 | ~73（utils 2 + lifecycle 3 + cache 12 + observability 36 + stability 31） | 0 |
| **合计** | | **~608** | **~53** |

---

## 五、domains/ — 业务域接入层

`domains/` 对应架构 Layer 3（§37-§38），分为"域框架基础设施"和"域实例"两层。

```
src/domains/
├── registry/               # 域注册中心（← core/domain-registry/）
│   ├── domain-registry-service.ts
│   ├── domain-model.ts
│   ├── domain-event-payload.ts
│   ├── domain-smoke-test.ts
│   ├── registry-bootstrap.ts
│   ├── contract-registry.ts
│   ├── workflow-registry.ts
│   ├── tool-bundle-registry.ts
│   ├── plugin-spi.ts
│   ├── plugin-spi-registry.ts
│   ├── plugin-runtime-host.ts
│   ├── plugin-runtime-child.ts
│   ├── plugin-runtime-protocol.ts
│   └── index.ts
├── risk-profile/           # 域风险画像（NEW §37）
│   └── index.ts
├── knowledge-schema/       # 域知识结构（NEW §37）
│   └── index.ts
├── eval-framework/         # 域评估框架（NEW §37）
│   └── index.ts
├── prompt-library/         # 域 Prompt 库（NEW §37）
│   └── index.ts
├── recipes/                # DomainRecipe 原型模板（NEW §38）
│   └── index.ts
├── interaction-policy/     # 跨域交互策略（NEW §37）
│   └── index.ts
├── governance/             # 域治理（← core/divisions/）
│   ├── division-loader.ts
│   ├── division-loader-support.ts
│   ├── safe-load-division-registry.ts
│   ├── hr-role-governance-service.ts
│   └── index.ts
├── coding/                 # 代码研发域实例
│   └── index.ts
└── operations/             # 运维域实例
    └── index.ts
```

---

## 六、interaction/ — 智能交互层

`interaction/` 对应架构 Layer 4（§39-§44），全部为**新建模块**（老系统完全缺失）。

```
src/interaction/
├── nl-gateway/             # 自然语言任务入口（NEW §39）
│   ├── intent-parser/      #   意图解析
│   │   └── index.ts
│   ├── slot-resolver/      #   槽位提取
│   │   └── index.ts
│   ├── ambiguity-handler/  #   歧义处理与澄清对话
│   │   └── index.ts
│   └── index.ts
├── goal-decomposer/        # 目标分解引擎（NEW §40）
│   ├── planner/            #   分解策略（模板/LLM/混合/人工辅助）
│   │   └── index.ts
│   ├── dependency-graph/   #   任务依赖 DAG
│   │   └── index.ts
│   ├── validator/          #   分解结果验证
│   │   └── index.ts
│   └── index.ts
├── proactive-agent/        # 主动式 Agent 框架（NEW §41）
│   ├── trigger-engine/     #   触发器引擎（cron/event/threshold）
│   │   └── index.ts
│   ├── schedule-manager/   #   定时调度管理
│   │   └── index.ts
│   ├── event-watcher/      #   事件驱动唤醒
│   │   └── index.ts
│   └── index.ts
├── autonomy/               # 渐进式自主权模型（NEW §42）
│   ├── trust-scorer/       #   信任评分
│   │   └── index.ts
│   ├── level-manager/      #   自主权等级状态机
│   │   └── index.ts
│   ├── promotion-engine/   #   提升/降级规则引擎
│   │   └── index.ts
│   └── index.ts
├── dashboard/              # 统一运营看板（NEW §43）
│   ├── metric-aggregator/  #   指标聚合
│   │   └── index.ts
│   ├── health-scorer/      #   健康评分
│   │   └── index.ts
│   ├── alert-router/       #   告警路由
│   │   └── index.ts
│   └── index.ts
└── ux/                     # 非技术用户体验（NEW §44）
    ├── wizard/             #   可视化域接入向导
    │   └── index.ts
    ├── template-engine/    #   可视化工作流构建器
    │   └── index.ts
    ├── onboarding/         #   引导式用户首次体验
    │   └── index.ts
    └── index.ts
```

---

## 七、org-governance/ — 组织治理层

`org-governance/` 对应架构 Layer 5（§46-§51），除 `org-model/` 从 `core/hr/` 迁入少量代码外，其余为**新建模块**。

```
src/org-governance/
├── org-model/              # 组织层次模型（NEW §46，← core/hr/ 部分迁入）
│   ├── hierarchy/          #   组织树（company/division/department/team）
│   │   └── index.ts
│   ├── org-node/           #   OrgNode CRUD + 层级继承
│   │   └── index.ts
│   ├── sync/               #   组织变更同步（SCIM/HR API/手动）
│   │   └── index.ts
│   ├── hr-role-governance-service.ts  # ← core/hr/
│   └── index.ts
├── approval-routing/       # 组织架构审批路由（NEW §47）
│   ├── route-engine/       #   动态路由引擎（org-chart/amount-based/SoD）
│   │   └── index.ts
│   ├── escalation/         #   审批升级
│   │   └── index.ts
│   ├── delegation/         #   审批委托（请假代理）
│   │   └── index.ts
│   └── index.ts
├── sso-scim/               # SSO/SCIM 集成（NEW §48）
│   ├── saml/               #   SAML SSO
│   │   └── index.ts
│   ├── oidc/               #   OIDC SSO
│   │   └── index.ts
│   ├── scim-sync/          #   SCIM 用户/组同步
│   │   └── index.ts
│   └── index.ts
├── compliance-engine/      # 分部门合规策略引擎（NEW §49）
│   ├── policy-resolver/    #   策略解析（继承+覆盖）
│   │   └── index.ts
│   ├── inheritance/        #   策略继承规则（子只能收紧不能放松）
│   │   └── index.ts
│   ├── audit-enforcer/     #   合规审计执行
│   │   └── index.ts
│   └── index.ts
├── knowledge-boundary/     # 知识域隔离与受控共享（NEW §50）
│   ├── boundary-manager/   #   边界定义（strict/controlled/open）
│   │   └── index.ts
│   ├── sharing-gate/       #   跨域共享网关
│   │   └── index.ts
│   ├── access-log/         #   访问审计日志
│   │   └── index.ts
│   └── index.ts
└── delegated-governance/   # 分级治理委托（NEW §51）
    ├── scope-manager/      #   委托范围管理
    │   └── index.ts
    ├── delegation-registry/ #  委托注册
    │   └── index.ts
    └── index.ts
```

---

## 八、scale-ecosystem/ — 规模化运行层 + 生态层

`scale-ecosystem/` 对应架构 Layer 6（§52-§57）。`feedback-loop/` 从 `core/feedback/` 迁入，`marketplace/` 从 `core/product/` 部分迁入，其余为**新建模块**。

```
src/scale-ecosystem/
├── multi-region/           # 多 Region 部署（NEW §52）
│   ├── region-router/      #   Region 路由决策
│   │   └── index.ts
│   ├── data-replicator/    #   跨 Region 数据同步
│   │   └── index.ts
│   ├── failover-controller/ #  Region 故障切换
│   │   └── index.ts
│   └── index.ts
├── resource-manager/       # 资源竞争管理（NEW §53）
│   ├── fair-queue/         #   加权公平队列
│   │   └── index.ts
│   ├── quota-enforcer/     #   配额执行
│   │   └── index.ts
│   ├── preemption/         #   优先级抢占
│   │   └── index.ts
│   └── index.ts
├── sla-engine/             # SLA 分级保障（NEW §54）
│   ├── tier-resolver/      #   SLA 等级解析
│   │   └── index.ts
│   ├── resource-allocator/ #   资源分配
│   │   └── index.ts
│   ├── breach-detector/    #   SLA 违约检测
│   │   └── index.ts
│   └── index.ts
├── marketplace/            # Agent 市场与生态（NEW §55，← core/product/ 部分迁入）
│   ├── catalog/            #   市场目录
│   │   └── index.ts
│   ├── certification/      #   认证与安全扫描
│   │   └── index.ts
│   ├── publisher/          #   发布管理
│   │   └── index.ts
│   ├── billing-service.ts
│   ├── billing-service-async.ts
│   ├── billing-payment-gateway.ts
│   ├── cost-estimation-service.ts
│   ├── pmf-validation-service.ts
│   ├── marketplace-governance-service.ts
│   ├── compliance-program-service.ts
│   ├── ha-program-service.ts
│   ├── platform-operator-service.ts
│   ├── tenant-platform-service.ts
│   ├── tenant-platform-service-async.ts
│   ├── enterprise-capability-matrix-service.ts
│   ├── data-plane-flow-service.ts
│   ├── data-plane-flow-service-async.ts
│   ├── perception-service.ts
│   ├── perception-service-async.ts
│   └── index.ts
├── feedback-loop/          # 反馈驱动持续改进（§56，← core/feedback/）
│   ├── collector/          #   信号收集
│   │   ├── feedback-collector.ts
│   │   ├── feedback-model.ts
│   │   ├── signal-preprocessor.ts
│   │   ├── domain-event-feedback-consumer.ts
│   │   └── index.ts
│   ├── analyzer/           #   信号分析（NEW）
│   │   └── index.ts
│   ├── improvement-tracker/ #  改进追踪（NEW）
│   │   └── index.ts
│   └── index.ts
└── integration/            # 外部系统集成框架（NEW §57）
    ├── connector-registry/ #   连接器注册
    │   └── index.ts
    ├── connector-runtime/  #   连接器运行时
    │   └── index.ts
    ├── health-monitor/     #   连接器健康监控
    │   └── index.ts
    └── index.ts
```

---

## 九、ops-maturity/ — 运营成熟度层

`ops-maturity/` 对应架构 Layer 7（§59-§70）。`drift-detection/` 从 `core/evolution/` 迁入，其余为**新建模块**。

```
src/ops-maturity/
├── explainability/         # Agent 可解释性（NEW §59）
│   ├── evidence-collector/
│   │   └── index.ts
│   ├── causal-chain-builder/
│   │   └── index.ts
│   ├── explanation-renderer/
│   │   └── index.ts
│   ├── explanation-cache/
│   │   └── index.ts
│   └── index.ts
├── emergency/              # 紧急制动（NEW §60）
│   ├── panic-controller/
│   │   └── index.ts
│   ├── forensic-snapshot/
│   │   └── index.ts
│   ├── resume-protocol/
│   │   └── index.ts
│   └── index.ts
├── agent-lifecycle/        # Agent 统一生命周期（NEW §61）
│   ├── agent-registry/
│   │   └── index.ts
│   ├── version-manager/
│   │   └── index.ts
│   ├── canary-controller/
│   │   └── index.ts
│   ├── retirement/
│   │   └── index.ts
│   └── index.ts
├── edge-runtime/           # 离线与边缘部署（NEW §62）
│   ├── edge-orchestrator/
│   │   └── index.ts
│   ├── edge-executor/
│   │   └── index.ts
│   ├── local-model/
│   │   └── index.ts
│   ├── sync-queue/
│   │   └── index.ts
│   └── index.ts
├── drift-detection/        # 行为漂移检测（§63，← core/evolution/）
│   ├── fingerprint-builder/
│   │   └── index.ts
│   ├── changepoint-detector/
│   │   └── index.ts
│   ├── cross-agent-analyzer/
│   │   └── index.ts
│   ├── evolution-mvp-service.ts
│   ├── evolution-mvp-service-async.ts
│   ├── evolution-mvp-support.ts
│   ├── evolution-integration-service.ts
│   ├── evolution-registry.ts
│   ├── proposal-engine.ts
│   ├── reflection-engine.ts
│   ├── benchmark-runner.ts
│   ├── evidence-store.ts
│   ├── promotion-gate.ts
│   ├── rollout-manager.ts
│   └── index.ts
├── cost-optimizer/         # 成本归因与优化（NEW §64）
│   ├── attribution-engine/
│   │   └── index.ts
│   ├── recommendation-engine/
│   │   └── index.ts
│   ├── simulator/
│   │   └── index.ts
│   └── index.ts
├── workflow-debugger/      # 可视化调试器（NEW §65）
│   ├── timeline-renderer/
│   │   └── index.ts
│   ├── breakpoint-manager/
│   │   └── index.ts
│   ├── run-comparator/
│   │   └── index.ts
│   └── index.ts
├── compliance-reporter/    # 合规报告引擎（NEW §66）
│   ├── template-registry/
│   │   └── index.ts
│   ├── evidence-mapper/
│   │   └── index.ts
│   ├── report-renderer/
│   │   └── index.ts
│   └── index.ts
├── capacity-planner/       # 容量规划（NEW §67）
│   ├── trend-analyzer/
│   │   └── index.ts
│   ├── forecaster/
│   │   └── index.ts
│   ├── simulator/
│   │   └── index.ts
│   └── index.ts
├── multimodal/             # 多模态能力（NEW §68）
│   ├── image-processor/
│   │   └── index.ts
│   ├── speech-processor/
│   │   └── index.ts
│   ├── document-parser/
│   │   └── index.ts
│   ├── modality-router/
│   │   └── index.ts
│   └── index.ts
└── platform-ops-agent/     # 平台自运维 Agent（NEW §69）
    ├── incident-diagnoser/
    │   └── index.ts
    ├── config-optimizer/
    │   └── index.ts
    ├── capacity-predictor/
    │   └── index.ts
    ├── dev-assistant/
    │   └── index.ts
    ├── health-monitor/
    │   └── index.ts
    └── index.ts
```

---

## 十、plugins/ + sdk/ + apps/ + 顶层文件

### 10.1 plugins/ — 跨层插件生态

结构与老系统基本一致，SPI 模式保留：

```
src/plugins/
├── index.ts
├── builtin-plugin-registry.ts
├── growth-config.ts
├── operations-config.ts
├── adapters/               # 域适配器
│   ├── asset-production-adapter.ts
│   ├── crm-adapter.ts
│   ├── game-dev-adapter.ts
│   ├── github-adapter.ts
│   └── livestream-adapter.ts
├── planners/               # 规划器
│   └── basic-planner.ts
├── presenters/             # 展示器
│   ├── coding-presenter.ts
│   ├── growth-presenter.ts
│   └── operations-presenter.ts
├── retrievers/             # 检索器
│   ├── asset-production-retriever.ts
│   ├── coding-retriever.ts
│   ├── game-dev-retriever.ts
│   ├── growth-retriever.ts
│   ├── livestream-retriever.ts
│   └── operations-retriever.ts
└── validators/             # 验证器
    └── basic-evaluator.ts
```

### 10.2 sdk/ — SDK 与开发者体验（§22）

```
src/sdk/
├── pack-sdk/               # Business Pack 开发 SDK
│   └── index.ts
├── plugin-sdk/             # Plugin 开发 SDK
│   └── index.ts
├── client-sdk/             # 客户端 SDK（REST/WebSocket）
│   └── index.ts
└── cli/                    # CLI 入口（← src/cli/ 78 个脚本迁入）
    ├── acceptance-readiness.ts
    ├── api-server.ts
    ├── billing.ts
    ├── channel-gateway.ts
    ├── dispatch-execution.ts
    ├── dispatch-reconcile.ts
    ├── doctor.ts
    ├── inspect.ts
    ├── release-pipeline.ts
    ├── secret-management.ts
    ├── takeover.ts
    ├── task-board.ts
    ├── worker-handshake.ts
    ├── worker-register.ts
    ├── worker-writeback.ts
    ├── ... (其余 63 个 CLI 脚本，结构不变)
    └── index.ts
```

### 10.3 apps/ — 应用入口

```
src/apps/
├── api/                    # API Server 入口（组装 platform/interface/ 模块）
│   └── index.ts
├── console/                # Console UI 后端入口
│   └── index.ts
└── workers/                # Worker 进程入口（组装 platform/execution/ 模块）
    └── index.ts
```

### 10.4 顶层文件

```
src/
└── index.ts                # 平台主入口（启动引导 + 模块注册）
```

### 10.5 项目根目录文件（从老系统直接迁移）

```
new-platform/
├── package.json            # ← 直接迁移，清理不需要的脚本
├── tsconfig.json           # ← 直接迁移
├── tsconfig.build.json     # ← 直接迁移
├── eslint.config.js        # ← 直接迁移
├── .c8rc.json              # ← 直接迁移
├── Dockerfile              # ← 直接迁移，增加边缘部署变体
├── docker-compose.yml      # ← 直接迁移，增加 Redis cluster 变体
├── .env.example            # ← 直接迁移，增加 Layer 4-7 配置项
├── .github/workflows/      # ← 直接迁移 4 个 CI workflow
├── scripts/                # ← 直接迁移 CI/构建脚本
├── deploy/                 # ← 直接迁移部署清单
├── config/                 # ← 直接迁移 27 个配置文件
└── divisions/              # ← 改造迁移（适配 DomainDescriptor）
```

---

## 十一、tests/ — 测试目录结构

测试目录**镜像 `src/` 结构**，每个源码目录在 tests/ 下有对应的测试目录。

```
tests/
├── helpers/                # 测试基础设施（← 直接迁移 19 文件）
│   ├── fs.ts
│   ├── seed.ts
│   ├── typed-factories.ts
│   ├── env.ts
│   ├── golden.ts
│   ├── e2e-harness.ts
│   ├── integration-context.ts
│   ├── repository-harness.ts
│   ├── concurrent-runner.ts
│   ├── test-cleanup.ts
│   ├── process-guard.ts
│   ├── fixtures/
│   │   ├── base.ts
│   │   └── composite.ts
│   ├── perception.ts
│   ├── pmf.ts
│   ├── billing.ts
│   ├── api.ts
│   ├── cli.ts
│   └── pg-test-helper.ts
│
├── unit/                   # 单元测试（镜像 src/ 结构）
│   ├── platform/
│   │   ├── interface/
│   │   │   ├── api/
│   │   │   └── channel-gateway/
│   │   ├── control-plane/
│   │   │   ├── iam/
│   │   │   ├── approval-center/
│   │   │   ├── config-center/
│   │   │   ├── incident-control/
│   │   │   ├── rollout-controller/
│   │   │   └── audit-export/
│   │   ├── orchestration/
│   │   │   ├── oapeflir/
│   │   │   ├── planner/
│   │   │   ├── routing/
│   │   │   └── hitl/
│   │   ├── execution/
│   │   │   ├── dispatcher/
│   │   │   ├── lease/
│   │   │   ├── worker-pool/
│   │   │   ├── execution-engine/
│   │   │   ├── state-transition/
│   │   │   ├── ha/
│   │   │   ├── hot-upgrade/
│   │   │   ├── recovery/
│   │   │   ├── tool-executor/
│   │   │   ├── distributed-lock/
│   │   │   └── queue/
│   │   ├── state-evidence/
│   │   │   ├── truth/
│   │   │   ├── events/
│   │   │   ├── artifacts/
│   │   │   ├── memory/
│   │   │   └── knowledge/
│   │   ├── model-gateway/
│   │   ├── prompt-engine/
│   │   ├── contracts/
│   │   └── shared/
│   │       ├── cache/
│   │       ├── observability/
│   │       └── stability/
│   ├── domains/
│   │   ├── registry/
│   │   └── governance/
│   ├── interaction/        # 全部新建测试
│   │   ├── nl-gateway/
│   │   ├── goal-decomposer/
│   │   ├── proactive-agent/
│   │   ├── autonomy/
│   │   ├── dashboard/
│   │   └── ux/
│   ├── org-governance/     # 全部新建测试
│   │   ├── org-model/
│   │   ├── approval-routing/
│   │   ├── sso-scim/
│   │   ├── compliance-engine/
│   │   ├── knowledge-boundary/
│   │   └── delegated-governance/
│   ├── scale-ecosystem/
│   │   ├── marketplace/
│   │   ├── feedback-loop/
│   │   └── ...
│   ├── ops-maturity/
│   │   ├── drift-detection/
│   │   └── ...
│   ├── plugins/
│   └── sdk/
│       └── cli/
│
├── integration/            # 集成测试（按关注点分组）
│   ├── platform/
│   │   ├── security/       # 64 个安全边界测试
│   │   ├── runtime/        # dispatch/lease/worker/recovery
│   │   ├── storage/        # 数据完整性
│   │   ├── contract/       # 合约验证
│   │   ├── reliability/    # 可靠性不变量
│   │   ├── concurrency/    # 并发测试
│   │   ├── recovery/       # 恢复测试
│   │   └── observability/  # 可观测性
│   ├── interaction/        # 全部新建
│   ├── org-governance/     # 全部新建
│   ├── scale-ecosystem/
│   ├── ops-maturity/
│   └── sdk/
│       └── cli/            # 32 个 CLI 集成测试
│
├── golden/                 # Golden 快照测试（← 直接迁移）
│   ├── diagnostics-bundle.test.ts
│   ├── openapi-document.test.ts
│   ├── release-plan-output.test.ts
│   ├── session-summary.test.ts
│   ├── phase1a-golden-tasks.test.ts
│   ├── prompt-assembly.test.ts
│   ├── workflow-validation.test.ts
│   ├── cli-help-text.test.ts
│   └── snapshots/
│
├── e2e/                    # 端到端测试（← 改造迁移 10 文件）
│   ├── task-lifecycle.test.ts
│   ├── multi-step-workflow.test.ts
│   ├── lease-recovery.test.ts
│   ├── operator-takeover.test.ts
│   ├── error-propagation.test.ts
│   ├── oapeflir-full-loop.test.ts
│   ├── session-memory-flow.test.ts
│   ├── gateway-webhook-flow.test.ts
│   ├── streaming-response.test.ts
│   └── approval-event-flow.test.ts
│
├── performance/            # 性能测试（← 直接迁移 6 文件）
│
└── fixtures/               # 测试夹具（← 改造迁移）
    └── migration/
```

---

## 十二、统计汇总

### 12.1 目录统计

| 顶层目录 | 架构层 | 二级目录数 | 迁移文件数 | 新建文件数 | 合计 |
|----------|--------|-----------|-----------|-----------|------|
| `platform/` | Layer 1-2 | 10 | ~608 | ~53 | ~661 |
| `domains/` | Layer 3 | 10 | ~18 | ~8 | ~26 |
| `interaction/` | Layer 4 | 6 | 0 | ~24 | ~24 |
| `org-governance/` | Layer 5 | 6 | ~2 | ~18 | ~20 |
| `scale-ecosystem/` | Layer 6 | 6 | ~27 | ~18 | ~45 |
| `ops-maturity/` | Layer 7 | 11 | ~12 | ~44 | ~56 |
| `plugins/` | 跨层 | 5 | ~20 | 0 | ~20 |
| `sdk/` | 跨层 | 4 | ~78 | ~5 | ~83 |
| `apps/` | 入口 | 3 | 0 | ~3 | ~3 |
| **src/ 合计** | | **61** | **~765** | **~173** | **~938** |

### 12.2 与老系统对比

| 指标 | 老系统 | 新平台 | 变化 |
|------|--------|--------|------|
| 顶层 src/ 目录数 | 4（core/cli/gateway/plugins） | 9（platform/.../sdk/apps/plugins） | +5 |
| 二级目录数 | 43（core/ 下扁平） | 61（按七层分布） | +18 |
| 最大单目录文件数 | 101（core/storage/）| ~40（拆分后最大目录） | -60% |
| 最大单模块行数 | 30,348（core/runtime/）| ~5,000（拆分为 12 BC） | -83% |
| 循环依赖风险 | 高（42 模块扁平） | 低（层级依赖 + 契约解耦） | 显著改善 |

### 12.3 依赖方向规则

```
Layer 7  ops-maturity/     ──→ 可依赖 Layer 1-6
Layer 6  scale-ecosystem/  ──→ 可依赖 Layer 1-5
Layer 5  org-governance/   ──→ 可依赖 Layer 1-4
Layer 4  interaction/      ──→ 可依赖 Layer 1-3
Layer 3  domains/          ──→ 可依赖 Layer 1-2
Layer 1-2 platform/        ──→ 仅依赖 platform/contracts/ 和 platform/shared/
跨层     plugins/sdk/apps/ ──→ 可依赖任意层（通过 interface 注入）
```

**禁止**：下层依赖上层（如 platform/ 不得 import interaction/）。同层模块间通过事件总线或 platform/contracts/ 解耦。
