# 平台架构设计 vs 代码实现 — 逐条复核版

> **版本**: v8.2
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
| `open` | 5 | `P1-1` `P1-2` `P1-3` `P1-5` `P2-1` |
| `partial` | 4 | `P1-4` `P1-6` `P1-7` `P2-2` |
| `closed` | 4 | `P0-1` `P0-2` `P0-3` `P2-3` |

结论：

- `§11.8` 与 `§12.1-§12.2` 已补齐 authoritative contract、运行时接线与定向测试，`P0-1 ~ P0-3` 不再是当前阻断项。
- 当前剩余高优先级缺口集中在 IAM 主模型与 API/outbox 主链：`Principal`、sandbox 层级、三层授权、cursor pagination、webhook-outbox。
- 领域元模型、24 域 baseline、12 种 recipe 这些能力不是空白；相关旧缺口保持为“实现形态与设计表达仍有偏差”的 `partial`。

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

状态：`open`

检查结果：

- `src/platform/control-plane/iam/policy-engine.ts`
- `src/platform/control-plane/approval-center/approval-policy-engine/types.ts`

上述两处 `subjectType` 仍是：

```ts
"user" | "agent" | "system"
```

- 未扩展到设计要求的 `service | worker | plugin`。

结论：

- 这条仍未收口。

### P1-2 `§11.4` Sandbox 层级

状态：`open`

检查结果：

- `src/platform/control-plane/iam/sandbox-policy.ts` 仍定义 `read_only | workspace_write | danger_full_access`。
- `tests/unit/platform/control-plane/iam/sandbox-policy-types.test.ts` 与 `tests/unit/platform/control-plane/iam/index.test.ts` 明确仍把 `danger_full_access` 当作合法值。
- `src/platform/execution/plugin-executor/plugin-executor.service.ts` 虽然有 `scoped_external_access` sandbox tier，但最终仍映射到 `workspace_write`，没有形成设计要求的四档 canonical sandbox mode。

结论：

- 不是完全空白，但仍未达到设计要求的 authoritative 四档模型。

### P1-3 `§6.6` Cursor-based 分页

状态：`open`

检查结果：

- `src/platform/interface/api/http-server/task-routes.ts` 的 `/v1/tasks`、`/v1/workflows` 仍使用 `limit` 读取，没有 `cursor / next_cursor / has_more`。
- `src/platform/interface/api/openapi-document.ts` 也没有为这些列表接口声明 cursor 分页面。
- `tests/unit/platform/interface/api/http-server/task-routes.test.ts` 与 `tests/integration/platform/interface/api/http-api-server.test.ts` 仍围绕 `?limit=` 断言。

结论：

- 这条仍未收口。

### P1-4 `§21.1` HITL 七种模式

状态：`partial`

检查结果：

- `src/platform/orchestration/hitl/` 已有 `hitl-approval-orchestration-service.ts`、`hitl-inbox-service.ts`、`hitl-operator-console-service.ts`、`hitl-explainability-service.ts`。
- `tests/integration/platform/orchestration/hitl-integration.test.ts` 覆盖了 `confirmed / text_input / rejected / timeout` 等决策流。
- 但全仓未形成 authoritative `HitlMode`/`hitl-modes.ts`，也未找到对设计中 7 个模式
  `single_approval / multi_party_approval / delegated_approval / iterative_feedback / collaborative_edit / informed_confirmation / circuit_breaker_human`
  的统一枚举、逐模式接线和逐模式测试命名。

结论：

- HITL 子系统本身存在且不弱，但“七种模式齐备并经 authoritative 类型约束”这件事没有闭环。

### P1-5 `§11.2` RBAC + Capability + Context-aware 三层授权

状态：`open`

检查结果：

- `src/platform/control-plane/iam/policy-engine.ts` 主要还是 `decision request -> budget/risk/approval` 的评估链。
- 仓内未找到 authoritative `PlatformRole`、`role-definitions.ts`、`capability-matrix.ts`。
- 也未找到清晰的 `RBAC -> capability -> context-aware` 三层统一入口。

结论：

- 这条仍未收口。

### P1-6 `§71-§94` 垂直域专属架构

状态：`partial`

检查结果：

- `src/domains/domain-baseline-catalog.ts` 已有 24 域 canonical baseline、legacy alias、workflow/tool/risk/eval/latency/ownership wiring。
- `tests/unit/domains/domain-baseline-catalog.test.ts` 与 `tests/integration/domains/domains-mainline-integration.test.ts` 明确验证了 24 域激活、canonical `domainId`、legacy alias、specialized workflow 和 config path。
- 但这些能力目前主要收敛在统一 catalog / orchestration 层，而不是设计文档写法中的“每个垂直域都有独立专属架构模块/章节对应代码面”。

结论：

- 这条不能再写成“缺失”，但也不能写成“完全对齐”；应保留为设计表达与实现形态不完全一致的 `partial`。

### P1-7 `§68` 多模态视频处理

状态：`partial`

检查结果：

- `src/ops-maturity/multimodal/multimodal-gateway-service.ts` 文件头注释已明确写明：当前视频链路仍是 metadata parsing + simulated transcription skeleton。
- `src/ops-maturity/multimodal/video-processor/index.ts` 当前实现是 URI 推断 metadata、伪 transcript、伪 keyframe。
- `tests/unit/ops-maturity/multimodal/video-processor.test.ts` 也都围绕这个 deterministic skeleton。

结论：

- 旧版判断成立，但应改写成“已具 skeleton 与测试，不是空白”。

### P2-1 `§6.7` Webhook + Outbox

状态：`open`

检查结果：

- `src/platform/interface/api/http-server/webhook-routes.ts` 只做 endpoint 管理。
- `src/platform/shared/outbox/` 与 `src/platform/state-evidence/events/transactional-event-appender.ts` 已有 outbox 基础设施。
- 但没有看到 webhook 管理/投递主链接入 outbox 的 authoritative 集成点。

结论：

- 这条仍是有效缺口。

### P2-2 `§26.3` 逻辑表数量差异

状态：`partial`

检查结果：

- 旧版 review 的“实际 55 张表”已经过时。
- 本次按 schema/migration 文件静态对账，仓内可见 `CREATE TABLE IF NOT EXISTS` 唯一表名为 **85** 张。
- 问题已经不是“表太少”，而是“设计文档 `71` 张逻辑表的数字与当前 schema 演进不一致”。

结论：

- 这是文档/contract 对账问题，不是运行时缺失；保留为 `partial`，等待设计文档或 schema 对照表修正。

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

1. 先处理 `P1-1/P1-2/P1-5`，把 IAM 主模型一次性补齐。
2. 再处理 `P1-3` 与 `P2-1`，把 API 列表分页和 webhook-outbox 契约补到主链。
3. `P1-4/P1-6/P1-7/P2-2` 作为结构深化项继续保留 `partial`，逐个补 authoritative 类型与对账文档。

---

## §5 本轮回写说明

- 本文件已去除重复段落，不再保留两份互相冲突的 v8 内容。
- 结论已同步回写到：
  - `docs_zh/analysis/00-architecture-coverage-matrix.md`
  - `docs_zh/operations/current_todo_list.md`
- 本次没有因为文档收口去删减缺口；所有 `P0/P1/P2` 都保留并给出复核结果，其中 `P0-1 ~ P0-3` 已按真实代码与测试证据关闭。
