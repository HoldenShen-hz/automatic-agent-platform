# 架构设计 vs 实现状态 — authoritative 收口评审

> **版本**: v6.1
> **评审日期**: 2026-04-23
> **设计文档**: `docs_zh/architecture/00-platform-architecture.md`
> **对账依据**: `src/` 实际实现、可运行测试、`docs_zh/analysis/00-architecture-coverage-matrix.md`、`docs_zh/operations/current_todo_list.md`
> **结论口径**: 以“仓内代码 + 可运行测试”为最终真相源；历史 review 中已过期的缺口已在本版关闭，不再重复保留

---

## 评审符号说明

| 符号 | 含义 | 判定标准 |
| --- | --- | --- |
| ✅ | 已实现 | 架构要求已有 authoritative 代码入口，并有 unit / integration / contract / golden / performance 中至少一种章节级验证 |
| 🟡 | 部分实现 | 能力存在且已接入主链，但部分子能力仍属 contract-only、仓外依赖、或后续可增强项 |
| ⭕ | 仓外/非阻断 | 不在本仓本轮交付边界，保留设计与 inventory/readiness 证明，不承诺真实外部基础设施闭环 |

---

## 总览：三环实现状态

| 环 | 范围 | 当前状态 | 评语 |
| --- | --- | --- | --- |
| 生存环 (Ring 1) | 核心执行、Harness、风控、审批、恢复、ModelGateway、Prompt、Eval | ✅ | 已形成可运行、可恢复、可审计的主链 |
| 可用环 (Ring 2) | NL 入口、HITL、Async、Domain Meta Model、ACP、工作台产品层 | ✅ | 已有统一 API / dashboard / workbench / workflow 主链 |
| 扩展环 (Ring 3) | 24 域 baseline、marketplace、多 region、ops-maturity、合规与部署 inventory | 🟡 | S1-S3 仓内闭环已形成；真实 S4 集群级形态继续仓外 |

---

## Part I — 基础设施平台（§4-§14, §24-§32）

### 总评: ✅ 对齐率高，仓内阻断缺口仅剩 S4 集群级部署

| 节 | 状态 | 关键证据 |
| --- | --- | --- |
| §4-§7 | ✅ | `src/platform/*`、`src/platform/interface/api`、`src/platform/state-evidence/events` 与对应 integration / contract 测试 |
| §8 | 🟡 | S1-S3 扩展面、SDK/workbench、plugin SPI、registry 已闭环；真实 K8s 集群级分片仍为仓外项 |
| §9-§14 | ✅ | stability / control-plane / observability / OAPEFLIR / execution 主链稳定 |
| §24-§32 | ✅ | projection / benchmark / deployment / readiness / HA inventory 已有 authoritative service 与测试 |

#### I-1: §8 S4 K8s 集群级分片未纳入本仓交付 (保留)

该项属于真实部署拓扑与集群编排能力，当前仓内保留 contract、inventory、readiness drill 与 failover 证明，不在本轮 `R0-R6` 完成定义内。

#### I-2: §13.5 OAPEFLIR ↔ Harness 语义映射已实现 (已关闭)

- authoritative 入口：`src/platform/orchestration/harness/oapeflir-harness-mapping.ts`
- 主链接线：Harness step / report 已写入显式语义阶段
- 结论：不再作为待开发缺口

---

## Part II — AI 运营（§15-§23）

### 总评: ✅ 已形成完整运营主链

| 节 | 状态 | 关键证据 |
| --- | --- | --- |
| §15 | ✅ | `src/platform/model-gateway`、provider routing、degradation、cost attribution |
| §16 | ✅ | `src/platform/prompt-engine/rollout`、`prompt-rollout-stage.ts`、release orchestration 测试 |
| §17 | ✅ | `src/domains/eval-framework`、judge provider registry、quality gate、prompt release 集成回归 |
| §18 | ✅ | cost tracking / budget / optimization 服务与测试 |
| §19 | ✅ | delegation / context isolation / topology validator |
| §19.5 | ✅ | `src/platform/orchestration/agent-delegation/collaboration-protocol/` 已接入主链 |
| §20-§23 | ✅ | long-running workflow、HITL、SDK/workbench、compliance 产品面均已落地 |

#### II-1: §19.5 Agent 协作协议 (ACP) 已实现 (已关闭)

- authoritative 入口：`src/platform/orchestration/agent-delegation/collaboration-protocol/`
- 能力范围：message schema、强制字段、不变量校验、主链接线、审计入口
- 结论：不再保留为 gap

#### II-2: ModelGateway facade 的 `complete()/embed()` 已实现并经导出面验证 (已关闭)

- 实现入口：`src/platform/model-gateway/provider-registry/unified-chat-provider.ts`
- facade 可见性回归：`tests/unit/platform/model-gateway/provider-registry/unified-chat-provider.test.ts`
- 结论：该项已从“实现存在但 facade 不可见”收口到 canonical provider-registry 出口

#### II-3: 额外 LLM provider 丰富度扩展 (非阻断保留)

当前 provider 抽象、降级与 cost attribution 主链已成立。继续增加 provider 种类属于能力深化，不再作为 `R0-R6` 未完成理由。

---

## Part III — 领域接入（§37-§38）

### 总评: ✅ canonical meta-model、recipe、bootstrap、review 已对齐

| 节 | 状态 | 关键证据 |
| --- | --- | --- |
| §37.1-§37.10 | ✅ | domain descriptor、baseline、registry、bootstrap 与 onboarding/rollout wiring 已稳定 |
| §37.11 | ✅ | `src/domains/canonical-meta-model/`、validator、seeder、completeness 计算与回归 |
| §38 | ✅ | descriptor review、evaluation gate、domain onboarding / rollout 测试 |

#### III-1: 领域规范元模型已实现并进入主链 (已关闭)

- authoritative 入口：`src/domains/canonical-meta-model/`
- 主链接线：domain bootstrap、descriptor review、baseline seeding、registry 校验
- 结论：不再存在“只有类型或 seeder、未被消费”的问题

#### III-2: DomainRecipe 12 原型与 canonical 领域接入链已闭环 (已关闭)

- authoritative 入口：`src/domains/domain-recipe-service.ts`
- 验证路径：recipe / registry / onboarding / rollout wiring 的 unit + integration 回归
- 结论：该项从历史 review 中的“仅 4 原型”更新为已关闭

---

## Part IV — 垂直业务域（§71-§94）

### 总评: ✅ 24 域 baseline 与域内运行面已形成 authoritative 闭环

当前实现不再是“24 域仅有泛化种子”。本仓已经具备：

- canonical `domain_id`
- legacy alias -> canonical 兼容映射
- 24 域 baseline 与 registry 入口
- domain-specific workflow / tool / risk / eval / latency / ownership wiring
- smoke / registry / onboarding / rollout / governance 路径验证

#### IV-1: canonical `domain_id` 与 legacy alias 已收口 (已关闭)

- authoritative 入口：`src/domains/domain-baseline-catalog.ts`
- 结论：历史 review 中列出的 12 个 ID 漂移已通过 canonical id 与兼容映射收口

#### IV-2: 24 域配置入口已存在 (已关闭)

- 配置与 runtime wiring 已进入 baseline / registry / bootstrap 主链
- 不再保留“23 域缺 config”的判断

#### IV-3: 域特化 workflow 不再停留在通用双步骨架 (已关闭)

- domain-specific workflow 已通过 registry / onboarding / rollout / smoke 测试暴露

#### IV-4 ~ IV-7: 风险覆写 / 评估指标 / 延迟与数据敏感性 / ownership wiring 已实现 (已关闭)

- 风险、评估、延迟、ownership 不再是 helper-only 元数据，已接入 baseline / governance / rollout 路径
- review 中关于“零域特化实现”的判断已失效

---

## Part V — 智能交互（§39-§44）

### 总评: ✅ 产品层已统一收口到平台工作台

| 节 | 状态 | 关键证据 |
| --- | --- | --- |
| §39-§43 | ✅ | NL gateway、goal decomposition、autonomy、dashboard、operator flows |
| §44 | ✅ | `src/interaction/ux/platform-workbench-snapshot-service.ts`、`src/interaction/dashboard`、`tests/integration/interaction/platform-workbench-integration.test.ts` |

结论：本层不需要独立新前端工程。平台工作台已通过现有 dashboard / API / UX orchestration / CLI 完成产品面收敛。

---

## Part VI — Harness 工程（§45, §58）

### 总评: ✅ Harness 八支柱与横切能力已从旧骨架演进为 canonical runtime 主链

历史 review 对 Harness 的判断已明显过期。当前仓内已具备：

- `ConstraintPack`、风险与输出策略
- `HarnessRun` 多生命周期与检查点/恢复
- `PlanBundle / WorkProduct / EvaluationReport / FeedbackEnvelope`
- `ToolbeltAssembler / GuardrailEngine / HitlRuntime / HarnessMemoryManager`
- `AsyncHarnessService / EvalRunService / DurableHarnessService`
- `ContextAssembler / RecoveryController / Replay / Learning / Audit`
- `HarnessLoopController` 与主链迭代接线

本轮新增收敛点：

- `src/platform/orchestration/harness/index.ts` 已将 `HarnessLoopController` 接入 `runLoop()`
- canonical harness 入口已导出 `./loop/index.js`
- 未覆盖用户脏文件 `src/platform/orchestration/harness/loop/index.ts`，仅通过兼容补丁与 barrel/export 完成接线

#### VI-1: 真实迭代循环已接回 HarnessRuntimeService (已关闭)

- authoritative 入口：`src/platform/orchestration/harness/index.ts`
- loop 入口：`src/platform/orchestration/harness/loop/index.ts`
- 回归：`tests/unit/platform/orchestration/harness/index.test.ts`、`tests/integration/platform/orchestration/harness/loop/index.integration.test.ts`、`tests/performance/harness-loop-performance.test.ts`

#### VI-2: 核心数据契约已实现 (已关闭)

- `PlanBundle / WorkProduct / EvaluationReport` 已具备 authoritative 契约与消费路径

#### VI-3: ConstraintPack 风险/输出策略已实现 (已关闭)

- Constraint merge 与 runtime enforcement 已进入 Harness 主链

#### VI-4: Durable Harness 已实现 (已关闭)

- suspend / resume / checkpoint / restore 语义已由 durable + workflow contracts 承接

#### VI-5: ContextAssembler / ContextSnapshot 已实现 (已关闭)

- context 组装、快照与恢复已不再缺位

#### VI-6: RecoveryController 已实现 (已关闭)

- recovery / checkpoint / failover drill 已进入 Harness 生命周期

#### VI-7 ~ VI-9: Toolbelt / Guardrails / HITL Runtime 已接回主链 (已关闭)

- 不再是 helper-only 模块，已留下 timeline / audit / approval / takeover 证据

#### VI-10 ~ VI-13: Feedback / Memory / Async / Eval Harness 已接回产品级运行闭环 (已关闭)

- 可通过 runtime / integration 路径验证，而非只存在于孤立模块

#### VI-14: Harness 可观测性 / Prompt 治理 / Failure-to-Learning / Replay 已形成章节级闭环 (已关闭)

- observability、prompt lineage、learning、replay 均已有服务与测试引用

#### VI-15: Harness 不变量与循环守卫已实现 (已关闭)

- `HarnessLoopController` 守卫与 runtime 决策路径已在单元、集成、性能回归中被覆盖

---

## Part VII — 组织治理（§46-§51）

### 总评: ✅ 对齐稳定

组织层次、审批路由、SSO/SCIM、合规策略、知识边界、分级治理委托均已有 authoritative service 与定向回归。本层无阻断缺口。

---

## Part VIII — 规模与生态（§52-§57）

### 总评: ✅ S1-S3 闭环稳定

多 region、资源竞争、SLA、marketplace、反馈改进、外部系统集成框架均已具备主链实现与测试。本层仅在真实 S4 集群拓扑上保留仓外边界，不影响 `R0-R6` 收口。

---

## Part IX — 运维成熟度（§59-§69）

### 总评: ✅ 叶子服务已脱离 stub 状态

`ops-maturity` 中被旧 review 点名的叶子工具已完成 authoritative 服务化，重点包括：

- `src/ops-maturity/platform-ops-agent`
- `src/ops-maturity/capacity-planner`
- `src/ops-maturity/compliance-reporter`
- `src/ops-maturity/drift-detection`
- `src/ops-maturity/workflow-debugger`
- `src/ops-maturity/multimodal`

#### IX-1: ops-maturity 叶子工具“高桩率”问题已关闭

- 结论：当前残留只属于可继续增强的能力深度，不再属于“模块仍为占位实现”

---

## Part X — 实施路线图（§33-§36 + 三环）

### 总评: ✅ authoritative 文档与目录结构已重新对齐

#### X-1: RoadmapService 阶段注册已对齐现状 (已关闭)

- `src/domains/roadmap/roadmap-service.ts` 已纳入后续 phase 模板注册

#### X-2: ADR 索引与缺失项已补齐 (已关闭)

- `docs_zh/adr/`、`docs_en/adr/` 与索引文档已更新

#### X-3: harness/ 目录与导出面已完成 canonical 对齐 (已关闭)

- 当前 remaining work 仅是未来可继续内聚实现，不再属于目录缺失或出口断裂

#### §33、§36 的说明

- 这两章天然以治理文档、路线图、成功标准为主
- 当前已具备 authoritative 文档闭环，不要求额外虚构运行时代码

---

## Part XI — 结论

### authoritative 结论

- `R0-R6` 本轮已完成收口：代码、测试、review、coverage matrix、todo 已同轮回写
- 历史 review 中的 `II-2 / III-1 / III-2 / IV-1~IV-7 / VI-1~VI-15 / IX-1 / X-1~X-3` 已全部关闭
- 当前仍保留的项只有仓外或非阻断增强项：
  - `I-1`: `S4 K8s` 集群级分片
  - `II-3`: 额外 LLM provider 丰富度扩展

### 本轮验证结果

已执行或纳入结项门禁的验证口径：

- `npm run build:test`
- Harness / loop / ModelGateway 定向 `unit + integration + performance`
- 文档 authoritative 回写一致性检查
- 最终 `npm test` 作为结项门禁

当前结项门禁已通过：`npm test` 与 `coverage:gate` 均为绿色，当前 coverage report 为 `Global lines: 87.8%`。

---

## 全局差距汇总

### 仓内阻断缺口

无。`R0-R6` 对应仓内缺口已完成收口。

### 仍保留但不阻断本轮验收的事项

| 编号 | 事项 | 状态 | 说明 |
| --- | --- | --- | --- |
| I-1 | `S4 K8s` 集群级分片 | ⭕ | 保留 contract / readiness / inventory；真实集群闭环仓外 |
| II-3 | 额外 LLM provider 扩充 | ⭕ | 当前 provider facade 已满足架构主链；后续可按需扩展 |

### 已知门禁阻塞

无。当前仓内结项门禁已通过。

### 收口后建议

后续迭代应继续遵守以下顺序：

1. 先对账 authoritative 文档，再施工
2. 只为有代码面和测试面的章节继续深化
3. 不再把已实现能力重复登记为 gap
