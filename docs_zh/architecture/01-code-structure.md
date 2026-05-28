# 新平台代码文件结构设计文档

> **文档版本**：v1.3
> **文档状态**：Active（代码结构复核后校准）
> **关联文档**：《企业级 Agent 平台总体技术架构设计文档》v2.7 §35 推荐代码目录
> **关联文档**：《老系统→新平台移植评估文档》v1.1
> **设计日期**：2026-04-19
> **最后续修**：2026-05-26（同步 P1 公共接口、联邦治理持久化、事件可靠性与 Electron/UI 契约修复）

---

## 一、文档目的

本文档定义新平台的**完整代码文件结构**，回答三个问题：

1. 新平台的 `src/` 目录如何组织？每个目录放什么？
2. 老系统（`src/core/` 42 个模块）的代码搬到新平台的哪个目录？
3. 新平台需要全新创建的模块、Mission/Yono、跨平台 UI 与专项测试放在哪里？

### 1.1 本次代码结构 Review 结论（2026-05-18）

本次 review 基于当前工作区目录实测，重点检查 `src/`、`ui/`、`tests/`、`config/`、`deploy/`、`scripts/` 与本文档的一致性。结论如下：

| 结论项 | 当前代码事实 | 文档处理 |
| ------ | ------------ | -------- |
| 后端七层主干 | `src/platform`、`domains`、`interaction`、`org-governance`、`scale-ecosystem`、`ops-maturity` 均存在且为权威实现位置 | 保持七层结构，更新统计和新增目录说明 |
| 五平面实现 | `five-plane-*` 五个目录完整，且新增 mission、outbox、side-effect-ledger、reconciliation、degradation 等子域 | 在 platform 说明中补齐新增子域 |
| Legacy core | `src/core` 仅剩 runtime 兼容入口，不应承载新增能力 | 保留兼容层定位，继续禁止新增业务能力进入 core |
| Mission | `src/platform/contracts/mission` 与 `src/platform/five-plane-control-plane/mission` 已成为长期目标治理入口 | 新增 Mission 目录职责和依赖规则 |
| Yono Business | `src/domains/yono` 已作为业务域实例存在 | 在 domains 章节标为业务域实例，不归入域框架基础设施 |
| 跨平台 UI | `ui/` Monorepo 已存在，包含 apps、packages、tools、tests | 新增 UI 顶层目录章节与依赖边界 |
| 测试结构 | `tests/unit`、`integration`、`e2e`、`golden`、`performance`、`invariants`、`leaks` 等均存在 | 更新测试目录说明，补齐 invariants/leaks |
| 运行配置与部署 | `config/`、`deploy/` 已覆盖环境、域、风险、安全、Helm、Terraform、Prometheus、Chaos、runbooks | 在顶层总览和运维目录说明中补齐 |
| 文档风险 | 大量统计仍可能随代码快速变化而过期 | 统计表改为“结构快照”，要求后续脚本生成 |

### 1.2 最近结构同步（2026-05-26）

本轮没有改动七层主骨架，但最近一批代码收口已经影响“结构应该怎么理解”的正式口径：

| 同步主题 | 当前代码事实 | 文档口径 |
| ------ | ------------ | -------- |
| P1 公共查询接口 | `dashboard-routes.ts` 已补齐 `/v1/workers`、`/v1/queues`、`/v1/agents`、`/v1/dashboard/metrics`、`/v1/explanations`、`/v1/meta/contract-version` | UI/HTTP 公共查询默认读取 Layer C `/v1/*`，不再把 `/admin/*` 当公共数据面 |
| P1 Pack / Knowledge / Builder 公共接口 | `pack-routes.ts`、`plane-routes.ts`、`task-routes.ts` 已补齐 `/v1/marketplace`、`/v1/knowledge`、`/v1/packs/:packId/versions`、`/v1/workflows/builder` | `platform/five-plane-interface/api/http-server/` 是当前公共导出面权威 |
| 联邦治理持久化 | `scale-ecosystem/federation/` 下 `federation-audit.ts`、`trust-relationship.ts` 已具备持久化/恢复/归档/策略 enforce | federation 不再是“纯规格承诺”，而是已落库的运行时能力 |
| 事件可靠性 | `durable-event-bus-async.ts` 已修复异步失败吞错 | P5 事件主链继续以可靠投递和失败可见性为准 |
| Electron 平台桥 | `ui/apps/electron-win/src/preload.ts` 与 `ui/packages/shared/platform/` 已统一桥接兼容层 | `ui/` 的桌面壳层已有正式 bridge 兼容契约，不只是 smoke shell |

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
│   ├── testing/            # 测试基础设施与公共测试契约
│   ├── benchmarks/         # 基准测试入口与性能样例
│   ├── core/               # Legacy 兼容重导出层，禁止新增业务能力
│   └── index.ts            # 平台入口
├── ui/                     # 跨平台 UI Monorepo（Web / Electron / Tauri / Mobile）
├── tests/                  # 测试（镜像 src/ 结构）
├── config/                 # 版本化配置
├── divisions/              # Division 定义（迁移后适配 DomainDescriptor）
├── docs_zh/                # 中文文档
├── docs_en/                # 英文文档
├── scripts/                # CI/构建脚本
├── deploy/                 # 部署清单
└── [顶层配置文件]           # package.json / tsconfig.json / eslint.config.js / Dockerfile / ...
```

### 3.0.1 顶层目录职责边界（当前权威）

| 顶层目录 | 代码事实 | 职责边界 | 禁止事项 |
| -------- | -------- | -------- | -------- |
| `src/platform/` | 后端平台核心，当前最大代码区 | 五平面、契约、共享基础设施、模型网关、Prompt/Eval、合规、稳定性 | 不得依赖 `interaction/`、`domains/` 业务实例或 UI |
| `src/domains/` | 域框架 + 域实例 | 领域 descriptor、risk/eval/workflow/tool 配置、Yono 等业务域 | 不得放平台 runtime、HTTP API、worker 实现 |
| `src/interaction/` | 智能交互层 | NL gateway、goal decomposer、dashboard、proactive、UX/autonomy | 不得绕过 platform contracts 直接写 truth store |
| `src/org-governance/` | 组织治理层 | 组织模型、审批路由、SSO/SCIM、合规边界、委托治理 | 不得承载通用 IAM 基础设施，基础 IAM 属于 control-plane |
| `src/scale-ecosystem/` | 规模化与生态层 | Marketplace、billing、SLA、多区域、feedback、runtime-services | 不得替代 P4/P5 的事实写入链路 |
| `src/ops-maturity/` | 运营成熟度层 | Chaos、debugger、capacity、compliance report、edge、explainability | 不得成为主执行链路的唯一依赖 |
| `src/plugins/` | 插件生态 | 插件 manifest、运行时适配、市场接入 | 不得绕过 sandbox 与 capability |
| `src/sdk/` | 开发者体验 | CLI、SDK、pack/plugin 工具 | 不得导入内部非 public API |
| `src/apps/` | 后端应用入口 | API、console backend、workers bootstrap | 不得沉淀业务逻辑，只做组合与启动 |
| `src/testing/` | 测试公共设施 | 测试 helper、fixture、invariant 支撑 | 不得被生产代码依赖 |
| `src/benchmarks/` | 性能样例入口 | 性能/容量基准辅助代码 | 不得进入 runtime 主链 |
| `ui/` | 前端 monorepo | Web/桌面/移动 UI、共享前端 SDK、feature packages、UI tests | 不得直接 import 后端 `src/*` 内部实现 |
| `tests/` | 后端测试 | unit/integration/e2e/golden/performance/invariants/leaks | 不得依赖生产环境真实凭证 |
| `config/` | 版本化配置 | environments、domains、risk、security、runtime、providers | 不得放 secret 明文 |
| `deploy/` | 部署与运维资产 | Helm、Terraform、Prometheus、Grafana、Chaos、runbooks、scripts | 不得作为业务逻辑来源 |

### 3.1 老系统 vs 新平台顶层对比

| 老系统 | 新平台 | 变化说明 |
|--------|--------|---------|
| `src/core/` (42 个扁平模块) | `src/platform/` + `src/domains/` + `src/interaction/` + `src/org-governance/` + `src/scale-ecosystem/` + `src/ops-maturity/` | 扁平 core/ 拆分为按七层架构组织的 6 个顶层目录 |
| `src/cli/` (78 个脚本) | `src/sdk/cli/` | CLI 归入 SDK 层 |
| `src/gateway/` (13 文件) | `src/platform/five-plane-interface/` + `src/interaction/nl-gateway/` | API gateway 归入 P1 Interface，NL gateway 归入 Layer 4 |
| 无独立前端工程 | `ui/` | 新增跨平台 UI Monorepo，承载 Web/桌面/移动端 |
| 无专项测试基础设施 | `src/testing/` + `tests/invariants/` + `tests/leaks/` | 新增测试基础设施、不变量与泄漏测试 |
| 无基准入口 | `src/benchmarks/` + `tests/performance/` | 新增性能/容量基准入口 |
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
| `core/config/` | `platform/five-plane-control-plane/config-center/` | P2 控制平面 |
| `core/storage/` | `platform/five-plane-state-evidence/truth/` | P5 状态与证据 |
| `core/events/` | `platform/five-plane-state-evidence/events/` | P5 状态与证据 |
| `core/locking/` | `platform/five-plane-execution/distributed-lock/` | P4 执行平面 |
| `core/queue/` | `platform/five-plane-execution/queue/` | P4 执行平面 |
| `core/cache/` | `platform/shared/cache/` | 跨层共享 |
| `core/api/` | `platform/five-plane-interface/api/` | P1 接口平面 |
| `core/resource/` | `platform/five-plane-execution/resource/` | P4 执行平面 |
| `core/runtime/` → Dispatch | `platform/five-plane-execution/dispatcher/` | P4 执行平面 |
| `core/runtime/` → Lease | `platform/five-plane-execution/lease/` | P4 执行平面 |
| `core/runtime/` → Worker | `platform/five-plane-execution/worker-pool/` | P4 执行平面 |
| `core/runtime/` → HA | `platform/five-plane-execution/ha/` | P4 执行平面 |
| `core/runtime/` → Recovery | `platform/five-plane-execution/recovery/` | P4 执行平面 |
| `core/runtime/` → HotUpgrade | `platform/five-plane-execution/hot-upgrade/` | P4 执行平面 |
| `core/runtime/` → StateMachine | `platform/five-plane-execution/state-transition/` | P4 执行平面 |
| `core/runtime/` → AgentExec | `platform/five-plane-execution/execution-engine/` | P4 执行平面 |
| `core/runtime/` → HITL | `platform/five-plane-orchestration/hitl/` | P3 编排平面 |
| `core/runtime/` → Orchestration | `platform/five-plane-orchestration/routing/` | P3 编排平面 |
| `core/agent-loop/` | `platform/five-plane-orchestration/oapeflir/` | P3 编排平面 |
| `core/planning/` | `platform/five-plane-orchestration/planner/` | P3 编排平面 |
| `core/orchestration/` | `platform/five-plane-orchestration/routing/` | P3 编排平面 |
| `core/providers/` | `platform/model-gateway/provider-registry/` | AI 运营 |
| `core/tools/` | `platform/five-plane-execution/tool-executor/` | P4 执行平面 |
| `core/workflow/` | `platform/five-plane-orchestration/oapeflir/workflow/` | P3 编排平面 |
| `core/artifacts/` | `platform/five-plane-state-evidence/artifacts/` | P5 状态与证据 |
| `core/feedback/` | `scale-ecosystem/feedback-loop/` | Layer 6 |
| `core/learning/` | `platform/five-plane-orchestration/oapeflir/learn/` | P3 编排平面 |
| `core/evaluation/` | `platform/prompt-engine/eval/` | AI 运营 |
| `core/memory/` | `platform/five-plane-state-evidence/memory/` | P5 状态与证据 |
| `core/knowledge/` | `platform/five-plane-state-evidence/knowledge/` | P5 状态与证据 |
| `core/messages/` | `platform/model-gateway/messages/` | AI 运营 |
| `core/domain-registry/` | `domains/registry/` | Layer 3 |
| `core/divisions/` | `domains/governance/` | Layer 3 |
| `core/security/` | `platform/five-plane-control-plane/iam/` | P2 控制平面 |
| `core/approvals/` | `platform/five-plane-control-plane/approval-center/` | P2 控制平面 |
| `core/compliance/` | `platform/compliance/` | AI 运营 |
| `core/cost/` | `platform/model-gateway/cost-tracker/` | AI 运营 |
| `core/hr/` | `org-governance/org-model/` | Layer 5 |
| `core/deployment/` | `platform/five-plane-control-plane/rollout-controller/` | P2 控制平面 |
| `core/improvement/` | `platform/five-plane-orchestration/oapeflir/improve-rollout/` | P3 编排平面 |
| `core/observability/` | `platform/shared/observability/` | 跨层共享 |
| `core/ops/` | `platform/five-plane-control-plane/incident-control/` | P2 控制平面 |
| `core/stability/` | `platform/shared/stability/` | 跨层共享 |
| `core/evolution/` | `ops-maturity/drift-detection/` | Layer 7 |
| `core/reliability/` | `platform/five-plane-execution/recovery/` | P4 执行平面 |
| `core/product/` | `scale-ecosystem/marketplace/` | Layer 6 |
| `gateway/` | `platform/five-plane-interface/` (拆分) | P1 接口平面 |
| `plugins/` | `plugins/` | 跨层 |
| `cli/` | `sdk/cli/` | 跨层 SDK |

---

## 四、platform/ — 基础设施层 + AI 运营层

`platform/` 对应架构 Layer 1（基础设施）和 Layer 2（AI 运营），包含五平面 + 横切关注点。

> **五平面命名约定**：实际代码中五个平面分别对应 `five-plane-interface/`、`five-plane-control-plane/`、`five-plane-orchestration/`、`five-plane-execution/`、`five-plane-state-evidence/` 五個带 `five-plane-` 前缀的目录，与文档中简称 `interface/`、`control-plane/` 等等价。两种命名均为有效入口，源码和配置中无歧义。

**补充说明（2026-05-18 续修）**：以下独立模块亦属于 platform/ 但不属于五平面之一：`agent-delegation/`、`architecture/`、`compliance/`、`contracts/`、`cost-management/`、`model-gateway/`、`ops-maturity/`、`prompt-engine/`、`prompt-registry/`、`remote-coordination/`、`shared/`、`stability/`、`structure/`。其中 `contracts/` 与 `shared/` 是平面间依赖的合法落点。

**Mission 结构说明（2026-05-18）**：Mission 是长期目标与治理上下文根对象，契约位于 `platform/contracts/mission/`，生命周期、解析、治理、预算、handoff 等控制能力位于 `platform/five-plane-control-plane/mission/`。执行平面只能消费 missionRef / missionSnapshotRef，不得把 Mission 当作可执行对象。

```
src/platform/
├── five-plane-interface/              # P1 接口平面 ── §6 API 契约
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
├── five-plane-control-plane/          # P2 控制平面 ── §24 配置 / §11 安全 / §21 审批
│   ├── tenant/             #   租户管理
│   │   └── index.ts
│   ├── mission/            #   Mission 长期目标治理（生命周期/解析/预算/LiveGuard/Handoff）
│   │   ├── mission-lifecycle-service.ts
│   │   ├── mission-resolver.ts
│   │   ├── mission-governance-service.ts
│   │   ├── mission-budget-service.ts
│   │   ├── mission-live-guard.ts
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
├── five-plane-orchestration/          # P3 编排平面 ── §13 OAPEFLIR
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
├── five-plane-execution/              # P4 执行平面 ── §14 Runtime
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
│   ├── hibernation/        #   长运行工作流休眠/唤醒
│   ├── queue-metrics/      #   队列指标与积压观测
│   ├── oapeflir/           #   执行侧 OAPEFLIR 桥接/运行记录
│   └── startup/            #   启动与预检
│       ├── startup-preflight.ts
│       ├── startup-consistency-checker.ts
│       ├── graceful-shutdown.ts
│       └── index.ts
│
├── five-plane-state-evidence/         # P5 状态与证据平面 ── §25-§29
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
│   ├── outbox/             #   可靠发布 Outbox
│   ├── side-effect-ledger/ #   外部副作用台账
│   ├── reconciliation/     #   状态/投影/外部写入对账
│   ├── compaction/         #   历史事件/上下文压缩
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
│   ├── degradation/        #   模型/Provider 降级策略
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
│   ├── mission/            #   Mission 契约（record/membership/snapshot/budget/error/event）
│   │   └── index.ts
│   ├── evidence-record/    #   证据记录契约
│   │   └── index.ts
│   ├── executable-contracts/ # 可执行契约与 PlanGraph 绑定
│   │   └── index.ts
│   ├── projection-update/  #   投影更新契约
│   │   └── index.ts
│   ├── prompt-bundle/      #   Prompt Bundle 契约
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

### 4.1 platform/ 统计快照（2026-05-18）

| 子目录 | 架构定位 | 当前 TS 文件数 | 说明 |
|--------|---------|---------------|------|
| `five-plane-interface/` | P1 接口平面 | 90 | API、channel gateway、console、scheduler、webhook |
| `five-plane-control-plane/` | P2 控制平面 | 140 | IAM、approval、config、incident、mission、risk、rollout |
| `five-plane-orchestration/` | P3 编排平面 | 188 | Harness、OAPEFLIR、planner、routing、HITL、learn、rollout |
| `five-plane-execution/` | P4 执行平面 | 230 | dispatcher、lease、worker、engine、queue、tool、recovery |
| `five-plane-state-evidence/` | P5 状态与证据 | 250 | truth、events、outbox、dlq、memory、knowledge、audit、ledger |
| `shared/` | 跨平面共享 | 130 | cache、observability、events、lifecycle、stability、context |
| `contracts/` | 跨平面契约 | 60 | request、plan、state、mission、evidence、prompt、projection |
| `model-gateway/` | AI 运营 | 28 | provider、router、fallback、degradation、cost、messages |
| `prompt-engine/` | AI 运营 | 26 | registry、renderer、rollout、eval |
| `compliance/` | AI 运营 | 12 | erasure、encryption、data residency、lineage |
| `stability/` | 稳定性/可靠性 | 48 | reliability 与稳定性演练补充 |
| 其他 platform 独立模块 | 横切/辅助 | 22 | architecture、agent-delegation、remote-coordination、structure 等 |
| **合计** | | **1,224** | 当前 `src/platform/**/*.ts` 快照 |

---

## 五、domains/ — 业务域接入层

`domains/` 对应架构 Layer 3（§37-§38），分为"域框架基础设施"和"域实例"两层。

> **实际域实例数量（2026-05-18 续修）**：`src/domains/` 下当前包含域框架基础设施、领域公共服务和 30+ 个垂直域实例。框架基础设施包括 `registry`、`risk-profile`、`knowledge-schema`、`eval-framework`、`prompt-library`、`recipes`、`interaction-policy`、`governance`、`business-pack`、`canonical-meta-model`；垂直域实例包括 `academic-research`、`advertising`、`agriculture`、`coding`、`financial-services`、`finance-accounting`、`healthcare`、`legal`、`quant-trading`、`yono` 等。`yono` 是 Yono Business 业务域实例，不能归入框架基础设施。

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
├── business-pack/          # 业务包域框架
│   └── index.ts
├── canonical-meta-model/   # 规范元模型
│   └── index.ts
├── coding/                 # 代码研发域实例
│   └── index.ts
├── operations/             # 运维域实例
│   └── index.ts
├── yono/                   # Yono Business 业务域实例
│   └── index.ts
├── [30+ 垂直域实例]         # academic-research、advertising、agriculture、content-moderation、creative-production、customer-service、data-engineering、ecommerce、education、executive-assistant、facilities、finance-accounting、financial-services、game-dev、game-publishing、healthcare、human-resources、industry-research、it-operations、knowledge-base、legal、live-streaming、manufacturing、marketing、product-management、project-management、quality-assurance、quant-trading、supply-chain、user-operations 等
└── [框架与公共服务]         # domain-baseline-catalog.ts、domain-baseline-seeds.ts、domain-descriptor-orchestration-service.ts、domain-eval-framework-service.ts、domain-knowledge-schema-service.ts、domain-module-helper.ts、domain-recipe-service.ts、domain-risk-profile-service.ts、domain-specs.ts、domain-task-design-service.ts、domains-bootstrap.ts
```

---

## 六、interaction/ — 智能交互层

`interaction/` 对应架构 Layer 4（§39-§44），全部为**新建模块**（老系统完全缺失）。

> **实际子模块（2026-05-18 续修）**：文档 §6 记录 6 个子目录，实际代码含 13 个含深层的子目录（autonomy、dashboard、goal-decomposer、nl-gateway、proactive-agent、ux 各有深层子模块），已全部反映在下方树状图和第十三节统计表中。

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

> **实际子模块（2026-05-18 续修）**：文档 §7 记录 7 个子目录，实际代码含 24 个含深层的子目录（approval-routing、compliance-engine、delegated-governance、knowledge-boundary、org-model、org-routing、sso-scim 各有深层子模块），已全部反映在下方树状图和第十三节统计表中。

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

> **实际子模块（2026-05-18 续修）**：文档 §8 记录 6 个顶层子目录，实际代码含 46 个含深层的子目录（billing、capacity-planning、cost-attribution、enterprise、federation、feedback-loop、integration、intelligence、marketplace、multi-region、operations、resource-manager、runtime-services、sla、sla-engine、tenant-platform 各有深层子模块），已全部反映在下方树状图和第十三节统计表中。

> **额外子模块（2026-05-18 续修）**：顶层模块数量已从 6 个扩展到 16 个（billing、capacity-planning、cost-attribution、enterprise、federation、intelligence、operations、runtime-services、sla、tenant-platform 等 10 个新增），已纳入第十三节统计。

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

> **实际子模块（2026-05-18 续修）**：文档 §9 记录 11 个顶层子目录，实际代码含 66 个含深层的子目录（agent-lifecycle、capacity-planner、chaos、compliance-reporter、cost-optimizer、drift-detection、edge-runtime、emergency、explainability、improvement、learning、monitoring、multimodal、platform-ops-agent、version-management、workflow-debugger 各有深层子模块），已全部反映在下方树状图和第十三节统计表中。

> **额外子模块（2026-05-18 续修）**：顶层模块数量已从 11 个扩展到 16 个（learning、monitoring 等新增），已纳入第十三节统计。

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

> **额外子模块（2026-05-18 续修）**：除文档所示 4 个模块外，实际代码还包含 `admin-sdk/`、`harness-sdk/`、`workbench/` 三个额外模块，已纳入第十三节统计。

```
src/sdk/
├── pack-sdk/               # Business Pack 开发 SDK
│   └── index.ts
├── plugin-sdk/             # Plugin 开发 SDK
│   └── index.ts
├── client-sdk/             # 客户端 SDK（REST/WebSocket）
│   └── index.ts
├── cli/                    # CLI 入口（← src/cli/ 78 个脚本迁入）
│   ├── acceptance-readiness.ts
│   ├── api-server.ts
│   ├── billing.ts
│   ├── channel-gateway.ts
│   ├── dispatch-execution.ts
│   ├── dispatch-reconcile.ts
│   ├── doctor.ts
│   ├── inspect.ts
│   ├── release-pipeline.ts
│   ├── secret-management.ts
│   ├── takeover.ts
│   ├── task-board.ts
│   ├── worker-handshake.ts
│   ├── worker-register.ts
│   ├── worker-writeback.ts
│   ├── ... (其余 63 个 CLI 脚本，结构不变)
│   └── index.ts
├── admin-sdk/              # 管理员 SDK
│   └── index.ts
├── harness-sdk/           # Harness SDK
│   └── index.ts
└── workbench/             # 工作台 SDK
    └── index.ts
```

### 10.3 apps/ — 应用入口

```
src/apps/
├── api/                    # API Server 入口（组装 platform/five-plane-interface/ 模块）
│   └── index.ts
├── console/                # Console UI 后端入口
│   └── index.ts
└── workers/                # Worker 进程入口（组装 platform/five-plane-execution/ 模块）
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

## 十一、ui/ — 跨平台 UI Monorepo

`ui/` 是当前仓库内的前端子工程，不迁入后端 `src/`。它通过 API-first、DTO → VM → Props、PlatformAdapter 和 feature gate 与后端交互。UI 代码不得直接 import 后端 `src/platform/*` 内部实现；只能依赖生成的契约、OpenAPI/schema、前端 shared API client 或 mock/contract seam。

```
ui/
├── apps/
│   ├── web/                # React + Vite Web SPA，可运行主入口
│   ├── electron-win/       # Windows Electron shell
│   ├── tauri-macos/        # macOS Tauri shell
│   ├── tauri-linux/        # Linux Tauri shell
│   └── mobile/             # React Native mobile shell
├── packages/
│   ├── shared/
│   │   ├── api-client/     # REST/WS client、endpoint binding
│   │   ├── auth/           # token/session/auth callback
│   │   ├── state/          # Query/store/offline persistence
│   │   ├── sync/           # offline queue/conflict resolver
│   │   ├── domain/         # DomainUIConfig、权限、字段脱敏
│   │   ├── platform/       # PlatformAdapter contract + adapters
│   │   ├── telemetry/      # 前端 telemetry
│   │   ├── i18n/           # locale/catalog
│   │   ├── nl-client/      # NL interaction client
│   │   └── types/          # 前端公共类型
│   ├── ui-core/            # Web/桌面设计系统、业务组件、charts、layout、theme
│   ├── ui-mobile/          # 移动端组件、native module seam、navigation
│   ├── features/           # 业务 feature packages，统一 web/mobile/hooks 拆分
│   │   ├── dashboard/
│   │   ├── task-cockpit/
│   │   ├── workflow-cockpit/
│   │   ├── approval/
│   │   ├── hitl/
│   │   ├── settings/
│   │   ├── domain-wizard/
│   │   ├── stability/
│   │   ├── takeover/
│   │   ├── alerts/
│   │   ├── dispatch/
│   │   ├── inspect/
│   │   ├── health/
│   │   ├── incidents/
│   │   ├── conversation/
│   │   ├── feature-flags/
│   │   ├── agent-manager/
│   │   ├── workflow-builder/
│   │   ├── workflow-debugger/
│   │   ├── explainability/
│   │   ├── cost-center/
│   │   ├── marketplace/
│   │   ├── analytics/
│   │   └── governance-compliance/
│   └── storybook/          # 组件文档与 visual review
├── tools/
│   ├── codegen/            # 从后端契约/OpenAPI/schema 生成前端类型和 endpoint binding
│   ├── mock-server/        # Planned endpoint / WS event typed mock
│   └── e2e/                # UI E2E tooling
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── features/
│   ├── apps/
│   ├── a11y/
│   ├── playwright/
│   └── docs/
└── docs/                   # UI ADR / Storybook 文档
```

### 11.1 UI Feature 目录规则

每个 `ui/packages/features/<feature>/src/` 必须保持同一拆分：

```
src/
├── web/                    # Web/desktop 渲染入口
├── mobile/                 # Mobile 渲染入口
├── hooks/                  # Query/VM hooks，只返回 ViewModel
├── route.ts                # route registration
├── permissions.ts          # feature guard / visibility
├── mapper.ts               # DTO → VM
└── index.ts                # public exports
```

规则：

- 组件不直接消费后端 DTO，必须经过 mapper 转为 VM。
- Planned 后端能力必须使用 feature gate + typed mock + 降级 banner。
- Platform-specific 能力只能通过 PlatformAdapter 注入，禁止在 feature 内直接调用 Electron/Tauri/RN API。
- UI tests 属于 `ui/tests/*` 或 `tests/unit/ui` / `tests/integration/ui`，不得混入后端 runtime 测试。

---

## 十二、tests/ — 测试目录结构

测试目录**镜像 `src/` 结构**，每个源码目录在 tests/ 下有对应的测试目录。

> **实际测试子目录（2026-05-18 续修）**：实际 `tests/` 包含 `unit/`、`integration/`、`e2e/`、`golden/`、`performance/`、`invariants/`、`leaks/`、`fixtures/`、`helpers/` 等专项目录；UI 也有独立 `ui/tests/`。测试目录不再只是简单镜像源码，还承担架构不变量、内存泄漏、部署、文档和 UI 验收。

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
│   │   ├── five-plane-interface/
│   │   │   ├── api/
│   │   │   └── channel-gateway/
│   │   ├── five-plane-control-plane/
│   │   │   ├── iam/
│   │   │   ├── approval-center/
│   │   │   ├── config-center/
│   │   │   ├── incident-control/
│   │   │   ├── rollout-controller/
│   │   │   └── audit-export/
│   │   ├── five-plane-orchestration/
│   │   │   ├── oapeflir/
│   │   │   ├── planner/
│   │   │   ├── routing/
│   │   │   └── hitl/
│   │   ├── five-plane-execution/
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
│   │   ├── five-plane-state-evidence/
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
│   ├── golden-tasks.test.ts
│   ├── prompt-assembly.test.ts
│   ├── workflow-validation.test.ts
│   ├── cli-help-text.test.ts
│   └── snapshots/
│
├── e2e/                    # 端到端测试
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
├── performance/            # 性能测试与容量基准
├── invariants/             # 架构不变量测试
├── leaks/                  # 内存/句柄泄漏测试
├── unit/ui/                # UI 单元测试镜像
├── integration/ui/         # UI 集成测试镜像
│
└── fixtures/               # 测试夹具（← 改造迁移）
    └── migration/
```

---

## 十三、统计汇总

### 13.1 目录统计快照（2026-05-18 第三轮结构 review）

> 说明：以下数字是当前工作区快照，用于结构 review，不作为长期人工维护的精确指标。后续应由脚本生成并同步到本文档，避免随代码增长过期。

| 顶层目录 | 架构层 | 当前 TS/TSX 文件数 | 结构状态 | 备注 |
|----------|--------|-------------------|----------|------|
| `src/platform/` | Layer 1-2 | 1,224 | 权威核心区 | 五平面 + contracts/shared/model-gateway/prompt/compliance |
| `src/domains/` | Layer 3 | 96 | 已扩展 | 含 canonical meta-model、业务域实例与 `yono/` |
| `src/interaction/` | Layer 4 | 52 | 已扩展 | NL、goal、dashboard、autonomy、UX |
| `src/org-governance/` | Layer 5 | 52 | 已扩展 | org model、approval routing、SSO/SCIM、compliance |
| `src/scale-ecosystem/` | Layer 6 | 148 | 已扩展 | marketplace、billing、SLA、多区域、runtime-services |
| `src/ops-maturity/` | Layer 7 | 121 | 已扩展 | chaos、debugger、capacity、edge、explainability |
| `src/plugins/` | 跨层 | 25 | 稳定 | 插件生态 |
| `src/sdk/` | 跨层 | 104 | 已扩展 | CLI、SDK、pack/plugin、harness/admin/workbench |
| `src/apps/` | 入口 | 4 | 稳定 | API/console/workers |
| `src/core/` | Legacy 兼容 | 8 | 兼容层 | 禁止新增业务能力 |
| `src/testing/` | 测试基础设施 | 1 | 稳定 | 生产代码不得依赖 |
| `src/benchmarks/` | 性能基准 | 1 | 稳定 | 基准入口 |
| `ui/` | UI Monorepo | 330 | 新增权威区 | apps/packages/tools/tests |
| `tests/` | 后端测试 | 6,000+ | 已扩展 | unit/integration/e2e/golden/performance/invariants/leaks |

> **五平面子模块计数说明（2026-05-18 续修）**：
> - `five-plane-control-plane/`：approval-center, audit-export, compliance, config-center, cost-alert, iam, incident-control, mission, policy-center, replay-repair-control, risk-control, rollout-controller, tenant + 深层 threat-model、runbook-executor 等 → 合计 44 个含深层的目录
> - `five-plane-execution/`：budget-allocator, compensation-manager, dispatcher, distributed-lock, execution-engine, ha, hibernation, hot-upgrade, lease, oapeflir, plugin-executor, queue, queue-metrics, recovery, reconciliation-worker, resource, runtime-state-machine, side-effect-manager, startup, state-transition, tool-executor, worker-pool → 17 个直接子目录
> - `five-plane-interface/`：api, channel-gateway, console, console-backend, ingress, scheduler, webhook 等 → 17 个含深层的目录
> - `five-plane-orchestration/`：agent-delegation, escalation, evaluator, harness, hitl, improve-rollout, learn, oapeflir, observer, planner, replan, routing 等 → 29 个含深层的目录
> - `five-plane-state-evidence/`：artifacts, audit, checkpoints, compaction, dlq, events, incident, knowledge, memory, outbox, projections, reconciliation, side-effect-ledger, truth 等 → 20 个含深层的目录

### 13.2 与老系统对比

| 指标 | 老系统 | 新平台 | 变化 |
|------|--------|--------|------|
| 顶层 src/ 目录数 | 4（core/cli/gateway/plugins） | 12（platform/domains/interaction/org/scale/ops/plugins/sdk/apps/core/testing/benchmarks） | +8 |
| 前端工程 | 无独立 monorepo | `ui/` Monorepo | 新增六平台 UI 基线 |
| 二级目录数 | 43（core/ 下扁平） | 100+（按七层、五平面、UI packages 分布） | 显著增加但边界更清晰 |
| 最大单目录文件数 | 101（core/storage/）| ~40（拆分后最大目录） | -60% |
| 最大单模块行数 | 30,348（core/runtime/）| ~5,000（拆分为 12 BC） | -83% |
| 循环依赖风险 | 高（42 模块扁平） | 低（层级依赖 + 契约解耦） | 显著改善 |

### 13.3 依赖方向规则

```
Layer 7  ops-maturity/     ──→ 可依赖 Layer 1-6
Layer 6  scale-ecosystem/  ──→ 可依赖 Layer 1-5
Layer 5  org-governance/   ──→ 可依赖 Layer 1-4
Layer 4  interaction/      ──→ 可依赖 Layer 1-3
Layer 3  domains/          ──→ 可依赖 Layer 1-2
Layer 1-2 platform/        ──→ 仅依赖 platform/contracts/ 和 platform/shared/
跨层     plugins/sdk/apps/ ──→ 可依赖任意层（通过 public interface 注入）
前端     ui/                ──→ 仅依赖 public API/OpenAPI/schema/codegen/mock seam
测试     tests/             ──→ 可依赖被测 public API；架构守护测试可扫描源码
```

**禁止**：下层依赖上层（如 platform/ 不得 import interaction/）。同层模块间通过事件总线或 platform/contracts/ 解耦。

### 13.4 当前结构风险与后续完善项

| 风险 | 说明 | 建议 |
| ---- | ---- | ---- |
| 人工统计易过期 | 目录和文件数量增长很快，人工表格容易失真 | 用 `scripts/ci/audit-codebase-inventory.mjs` 或新增结构盘点脚本生成 |
| 双入口命名并存 | `five-plane-*` 是权威源码目录，历史文档仍偶见 interface/control-plane 简称 | 新文档统一写 `five-plane-*`，简称只作为解释 |
| UI 与后端边界需持续守护 | UI 规模已较大，若直接 import 后端内部实现会破坏分层 | 增加 contract test 禁止 `ui/**` import `src/**` 内部路径 |
| Mission/Yono 后续会继续扩展 | Mission 与 Yono 已进入代码结构，但业务/治理能力还会增长 | 新增子目录时同步更新本文件对应章节 |
| `src/core/` 仍存在 | 作为兼容层合理，但容易被误用 | CI 守护新增业务代码不得进入 `src/core/` |
