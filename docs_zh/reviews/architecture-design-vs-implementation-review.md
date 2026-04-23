# 平台架构设计 vs 代码实现 — 逐条复核版

> **版本**: v8.3
> **复核日期**: 2026-04-23
> **设计基线**: `docs_zh/architecture/00-platform-architecture.md` v3.2
> **复核对象**: `src/`、`tests/`、`docs_zh/contracts/`
> **本次说明**: 不删除 review 文档；保留全部 `P0/P1/P2` 条目并逐条复核，清理此前文件中的重复段落与过期结论。

---

## §1 复核口径

### 1.1 判定规则

| 状态 | 含义 |
| --- | --- |
| `open` | 设计要求仍未形成 authoritative 类型/运行时/测试闭环 |
| `partial` | 已有明显实现，但与设计要求仍有关键缺口或只覆盖部分语义 |
| `closed` | 设计要求已能在代码与测试中找到直接证据 |

### 1.2 本次使用的证据类型

- authoritative 源码与导出面
- 现有 unit/integration/golden 测试文件
- schema / contract / OpenAPI / inventory 文件
- 结构化搜索结果与静态对账

### 1.3 验证限制

- 本次以仓内源码和测试文件静态复核为主。
- 直接用 `node --test` 运行源码侧 `.ts` 测试会因为仓库依赖 `dist/` 产物而出现 `ERR_MODULE_NOT_FOUND`，因此这类失败不作为功能结论。
- 本文不再沿用旧版“R0-R6 已全部收口 = review 全部关闭”的口径。

---

## §2 总结

| 类别 | 数量 | 条目 |
| --- | --- | --- |
| `open` | 0 | 无 |
| `partial` | 0 | 无 |
| `closed` | 13 | `P0-1` `P0-2` `P0-3` `P1-1` `P1-2` `P1-3` `P1-4` `P1-5` `P1-6` `P1-7` `P2-1` `P2-2` `P2-3` |

结论：

- `§11.8` 与 `§12.1-§12.2` 已补齐 authoritative contract、运行时接线与定向测试，`P0-1 ~ P0-3` 不再是当前阻断项。
- `P1-1 ~ P1-7` 已在本轮形成源码、导出面、定向测试与文档同步闭环。
- `P2-1` 与 `P2-2` 已补齐 authoritative runtime / inventory / API / 测试 / 文档同步证据；本轮 review 条目已全部关闭。
- 领域元模型、24 域 baseline、12 种 recipe 这些能力已经形成可复核实现；后续仅继续做增量增强，不再作为本轮 review 未关闭项。

---

## §3 逐条复核结果

### P0-1 `§12.1` 异常事件分类体系 `E1-E6`

状态：`closed`

检查结果：

- `src/platform/contracts/types/anomaly-event-classification.ts` 已新增 `AnomalyEventClass`、`ClassifiedAnomalyEvent`、`ANOMALY_EVENT_CLASSES` 与 `classifyAnomalyEvent()`。
- `src/platform/shared/observability/anomaly-detection-service.ts` 已把异常检测结果与 anomaly record 接入 `E1-E6` 分类。
- `src/platform/state-evidence/events/typed-event-payloads.ts` 新增 `ClassifiedAnomalyEventPayload`，`src/platform/state-evidence/events/event-types.ts` 新增 `anomaly:classified` tier-1 surface。
- 证据测试：
  - `tests/unit/platform/contracts/types/anomaly-event-classification.test.ts`
  - `tests/unit/platform/shared/observability/anomaly-detection-service.test.ts`
  - `tests/unit/platform/state-evidence/events/event-types.test.ts`
  - `tests/unit/platform/state-evidence/events/typed-event-payloads.test.ts`

结论：

- 这条已经形成 authoritative 类型、运行时接线与事件面测试闭环，应关闭。

### P0-2 `§12.2` 统一严重度 `SEV1-SEV4`

状态：`closed`

检查结果：

- `src/platform/contracts/types/unified-severity.ts` 已新增 `UnifiedSeverity`、`UNIFIED_SEVERITY_SLA` 与 anomaly/alert/runbook/diagnostic 四类 mapper。
- `src/platform/shared/observability/anomaly-detection-service.ts`、`src/platform/shared/observability/alert-dispatcher.ts`、`src/platform/shared/observability/slo-alerting-service.ts` 已输出 `unifiedSeverity`。
- `src/platform/control-plane/incident-control/operations-governance-service.ts` 已为 incident package 增加 `unifiedSeverity`。
- 证据测试：
  - `tests/unit/platform/contracts/types/unified-severity.test.ts`
  - `tests/unit/platform/shared/observability/slo-alerting-service.test.ts`
  - `tests/unit/platform/shared/observability/anomaly-detection-service.test.ts`

结论：

- 统一严重度已经存在 authoritative contract 与跨模块 mapper，这条应关闭。

### P0-3 `§11.8` STRIDE 威胁模型

状态：`closed`

检查结果：

- `src/platform/control-plane/iam/threat-model/stride-framework.ts` 已新增 `StrideCategory`、`ThreatEntry`、`ThreatMatrix`、`validateThreatMatrix()`。
- `src/platform/control-plane/iam/threat-model/threat-matrix-registry.ts` 已形成默认六维 threat matrix，并通过 `src/platform/control-plane/iam/index.ts` 导出。
- `config/security/threat-matrix.json` 已落 threat inventory 文件。
- 证据测试：
  - `tests/unit/platform/control-plane/iam/stride-framework.test.ts`

结论：

- STRIDE 已形成统一框架、registry 与 inventory 文件，这条应关闭。

### P1-1 `§11.1` Principal 类型

状态：`closed`

检查结果：

- `src/platform/control-plane/iam/policy-engine.ts`
- `src/platform/control-plane/approval-center/approval-policy-engine/types.ts`

检查结果：

- `src/platform/control-plane/iam/access-model.ts` 已新增 `PlatformPrincipalType`，并收敛 `user / agent / system / service / worker / plugin` 六类 principal。
- `src/platform/control-plane/iam/policy-engine.ts` 已改为消费 canonical IAM facade，并把 principal 进入 `RBAC + capability + context-aware` 统一授权链。
- `src/platform/control-plane/approval-center/approval-policy-engine/types.ts` 的 `ApprovalPolicyContext.subjectType` 已切换到同一 canonical 类型。
- 证据测试：
  - `tests/unit/platform/control-plane/iam/access-model.test.ts`
  - `tests/unit/platform/control-plane/iam/policy-engine.test.ts`

结论：

- Principal 类型已扩展并进入主链，应关闭。

### P1-2 `§11.4` Sandbox 层级

状态：`closed`

检查结果：

- `src/platform/control-plane/iam/sandbox-policy.ts` 已切换到 canonical 四档：
  `read_only / workspace_write / scoped_external_access / restricted_exec`。
- `src/platform/execution/plugin-executor/plugin-executor.service.ts` 已把 plugin sandbox tier 映射对齐到 canonical sandbox mode，并为 `scoped_external_access` / `restricted_exec` 生成正式 policy。
- `src/platform/control-plane/config-center/config-governance-support.ts` 与 `docs_zh/contracts/configuration_layers_and_defaults_contract.md` 已同步到四档枚举。
- 证据测试：
  - `tests/unit/platform/control-plane/iam/sandbox-policy-modes.test.ts`
  - `tests/unit/platform/control-plane/config-center/config-governance-service.test.ts`

结论：

- authoritative 四档 sandbox model 已闭环，应关闭。

### P1-3 `§6.6` Cursor-based 分页

状态：`closed`

检查结果：

- `src/platform/interface/api/http-server/task-routes.ts` 已为 `/v1/tasks` 与 `/v1/workflows` 增加稳定排序的 cursor 分页，返回 `nextCursor / hasMore / limit`。
- `src/platform/interface/api/http-server/utils.ts` 已补 opaque cursor 的读写/校验辅助函数。
- `src/platform/interface/api/openapi-document.ts` 已为两个列表面补上 cursor query parameter 描述。
- 证据测试：
  - `tests/unit/platform/interface/api/http-server/task-routes.test.ts`
  - `tests/golden/openapi-document.test.ts`

结论：

- cursor-based 分页已经形成 API + OpenAPI + golden/unit 证据闭环，应关闭。

### P1-4 `§21.1` HITL 七种模式

状态：`closed`

检查结果：

- `src/platform/orchestration/hitl/hitl-modes.ts` 已新增 authoritative `HitlMode`，覆盖
  `single_approval / multi_party_approval / delegated_approval / iterative_feedback / collaborative_edit / informed_confirmation / circuit_breaker_human` 七种模式。
- `src/platform/orchestration/hitl/hitl-approval-orchestration-service.ts` 已把 `mode` 接入 approval packet / request 主链，并为逐模式约束提供正式校验。
- `src/platform/orchestration/hitl/hitl-inbox-service.ts` 已把 `mode` 和 channel policy 接入 inbox surface。
- 证据测试：
  - `tests/unit/platform/orchestration/hitl/hitl-approval-orchestration-service.test.ts`
  - `tests/unit/platform/orchestration/hitl/hitl-inbox-service.test.ts`

结论：

- 七种模式已形成 authoritative 类型、运行时校验与测试闭环，应关闭。

### P1-5 `§11.2` RBAC + Capability + Context-aware 三层授权

状态：`closed`

检查结果：

- `src/platform/control-plane/iam/access-model.ts` 已新增 `PlatformRole`、`PlatformCapability`、role→capability map、默认 principal access profile 与 action→capability 推导。
- `src/platform/control-plane/iam/policy-engine.ts` 已显式按 `RBAC -> capability -> context-aware -> budget/risk` 顺序评估，并把三层结果写入 audit payload。
- 证据测试：
  - `tests/unit/platform/control-plane/iam/access-model.test.ts`
  - `tests/unit/platform/control-plane/iam/policy-engine.test.ts`

结论：

- 三层授权主链已收口，应关闭。

### P1-6 `§71-§94` 垂直域专属架构

状态：`closed`

检查结果：

- `src/domains/vertical-domain-architecture-service.ts` 已新增 authoritative 垂直域架构 surface，可把 24 域 materialize 为 `workflow / tooling / risk / eval / latency / ownership / knowledge / recipes` 八类 architecture section。
- `src/domains/index.ts` 已导出该服务，避免垂直域架构只停留在 baseline catalog 内部。
- 证据测试：
  - `tests/unit/domains/vertical-domain-architecture-service.test.ts`
  - `tests/integration/domains/domains-mainline-integration.test.ts`

结论：

- 已形成可消费的垂直域专属架构面，应关闭。

### P1-7 `§68` 多模态视频处理

状态：`closed`

检查结果：

- `src/ops-maturity/multimodal/video-processor/index.ts` 已形成 deterministic video pipeline，补齐 `VideoMetadata / VideoTranscriptSegment / VideoSceneSegment / VideoKeyFrame / VideoQualityAssessment / ProcessedVideo` authoritative surface，并实现 metadata parsing、transcript segment、scene timeline、scene-aware keyframe 与 readiness assessment。
- `src/ops-maturity/multimodal/multimodal-gateway-service.ts` 已将 video part 正式接入 `VideoProcessor`，输出 `video_duration_ms / resolution / scenes / transcript_segments / quality` 结构化 summary，并将 invalid/conditional video pipeline 通过 safety finding 暴露到主链。
- 证据测试：
  - `tests/unit/ops-maturity/multimodal/video-processor.test.ts`
  - `tests/unit/ops-maturity/multimodal/multimodal-gateway-service.test.ts`
  - `tests/integration/ops-maturity/multimodal-gateway-integration.test.ts`
  - `tests/integration/ops-maturity/multimodal-video-pipeline-integration.test.ts`
  - `tests/integration/scale-ops/scale-ops-mainline-integration.test.ts`

结论：

- 视频处理不再停留在 skeleton；它已经具备 authoritative 运行时、gateway 接线、定向 unit/integration 证据，应关闭。

### P2-1 `§6.7` Webhook + Outbox

状态：`closed`

检查结果：

- 已新增 `src/platform/interface/webhook/webhook-outbox-dispatch-service.ts`，把 `WebhookIngressService` 与 `OutboxRepository` 接成 authoritative runtime。
- `src/platform/interface/api/http-server/webhook-routes.ts` 新增 `POST /v1/webhooks/{endpointId}/receive` 与兼容路径的公开 intake surface。
- `src/platform/interface/api/http-api-server.ts` 已把 webhook receive/outbox dispatch 接入 canonical route table。
- `tests/unit/platform/interface/webhook/webhook-outbox-dispatch-service.test.ts`
- `tests/unit/platform/interface/api/http-server/webhook-routes.test.ts`
- `tests/integration/platform/interface/api/webhook-outbox-api-integration.test.ts`
- `tests/golden/openapi-document.test.ts`

结论：

- Webhook intake -> envelope 校验 -> outbox staging -> OpenAPI/API catalog 可见性已形成章节级闭环。

### P2-2 `§26.3` 逻辑表数量差异

状态：`closed`

检查结果：

- 已新增 `src/platform/state-evidence/truth/schema-inventory-service.ts` 作为 authoritative schema inventory surface。
- inventory 当前以 core schema + runtime/governance/reliability extension 对账，唯一逻辑表数为 **86**。
- `src/platform/interface/api/http-server/admin-routes.ts` 新增 `GET /v1/admin/inventories/schema`。
- `src/platform/interface/api/openapi-document.ts`、`src/platform/interface/api/api-resource-catalog-service.ts` 已同步暴露 schema inventory 与 webhook receive surface。
- `tests/unit/platform/state-evidence/truth/schema-inventory-service.test.ts`
- `tests/unit/platform/interface/api/http-server/admin-routes.test.ts`
- `tests/integration/platform/interface/api/schema-inventory-api-integration.test.ts`
- `tests/golden/openapi-document.test.ts`

结论：

- 已从“数字漂移争议”收口为 authoritative inventory + admin API + contract 对照表的闭环，后续若 schema 演进，只需更新 inventory 与对应文档，不再依赖旧的静态口径。

### P2-3 `§37.11` 统一领域元模型 12 问

状态：`closed`

检查结果：

- `src/domains/canonical-meta-model/types.ts` 定义了 12 个 question id：`Q1` 到 `Q12`。
- `src/domains/canonical-meta-model/meta-model-validator.ts` 会检查重复、缺失、未完成答案，并计算 completeness。
- `src/domains/canonical-meta-model/meta-model-seeder.ts` 为 12 问全部生成 seed。
- `tests/unit/domains/canonical-meta-model/meta-model-validator.test.ts`
- `tests/unit/domains/canonical-meta-model/meta-model-seeder.test.ts`
- `tests/integration/domains/canonical-meta-model/meta-model-integration.test.ts`

结论：

- 这条已经有完整代码与测试证据，应从 gap 中关闭。

---

## §4 建议的修复顺序

1. 继续保持 review、coverage matrix、todo、contract 与仓内代码/测试同轮同步，避免状态再次漂移。

---

## §5 本轮回写说明

- 本文件已去除重复段落，不再保留两份互相冲突的 v8 内容。
- 结论已同步回写到：
  - `docs_zh/analysis/00-architecture-coverage-matrix.md`
  - `docs_zh/operations/current_todo_list.md`
  - `docs_zh/contracts/storage_schema_contract.md`
  - `docs_zh/contracts/multimodal_gateway_contract.md`
- 本次没有因为文档收口去删减缺口；所有 `P0/P1/P2` 都保留并给出复核结果，当前条目已全部按真实代码与测试证据关闭。
