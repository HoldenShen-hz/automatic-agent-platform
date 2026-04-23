# 平台架构设计 vs 代码实现 — 收口评审

> 本文档用于表达当前仓库的“架构设计 vs 实现状态”。

> **版本**: v9.0
> **评审日期**: 2026-04-23
> **设计基线**: `docs_zh/architecture/00-platform-architecture.md`
> **authoritative 配套**:
> - `docs_zh/analysis/00-architecture-coverage-matrix.md`
> - `docs_zh/operations/current_todo_list.md`

---

## 1. 本轮结论

本轮按“仓内代码 + 可运行测试”重新核对 `review / coverage-matrix / current_todo_list` 三份 authoritative 文档，结论如下：

- `R0-R6` 已在仓内边界内完成收口。
- 先前 `review` 中保留的旧版 `P0/P1/P2` 缺口清单，已被确认属于过期评审结果，不再代表当前仓库真相。
- 当前仍保留的事项仅为明确标注的仓外或非本轮阻断项，不再作为 `R0-R6` 未完成理由。

本版评审替代之前重复保留的旧评审文本，作为新的单一真相源。

---

## 2. 评审口径

### 2.1 真相源

- 代码：`src/`
- 测试：`tests/`
- 运行验证：`npm run build:test`、受影响定向回归、`npm test`
- 文档：`review / coverage-matrix / current_todo_list`

### 2.2 判定原则

- `done / exists`：代码、导出面、测试、文档四者闭环。
- `contract-only`：仓内仅交付契约、inventory、readiness、drill、替身或 smoke 证明，不承诺真实集群闭环。
- `out-of-scope`：明确依赖仓外基础设施或不属于本轮 backlog。

---

## 3. R0-R6 收口结果

### R0. Todo / Review 口径重置

- `current_todo_list` 已切换到 `R0-R6` 结构。
- `coverage-matrix` 已按 authoritative src/tests 重新映射。
- 旧 `review` 中与仓内现状冲突的缺口描述已下线。

### R1. Harness 主链

- Harness 核心生命周期、sleep/resume/recovery、loop controller 主链已接通。
- `collaboration-protocol`、`ConstraintPack` 与 Harness canonical 入口的消费链已恢复一致。
- Harness 相关主链由 `unit + integration + performance` 覆盖。

### R2. ACP / OAPEFLIR↔Harness / ModelGateway facade

- ACP 与 Harness 语义映射已回到 canonical 入口。
- `UnifiedChatProvider.complete()/embed()` facade、barrel、CLI/API 可见性已闭环。

### R3. 领域元模型与 canonical domain

- `canonical-meta-model` 已进入 bootstrap / descriptor / registry 主链。
- 12 种 recipe、canonical `domain_id`、legacy alias 映射已有真实消费证据。

### R4. 24 域运行面

- 24 域 baseline 与 workflow/tool/risk/eval/latency/ownership wiring 已进入回归。
- registry / onboarding / rollout 路径可见。

### R5. Harness 子系统产品级闭环

- `ToolbeltAssembler`、`GuardrailEngine`、`HitlRuntime`、`HarnessMemoryManager`、`AsyncHarnessService`、`EvalRunService`、`DurableHarnessService`、`ContextAssembler`、`RecoveryController` 已进入 Harness 主链。
- timeline / checkpoint / audit / learning / replay 均有 integration 证据。

### R6. 文档治理与最终收口

- `RoadmapService`、ADR 索引、`harness/` 导出面与 ops-maturity 叶子服务已对齐现状。
- 三份 authoritative 文档已同步回写。

---

## 4. 章节级校正

以下章节在本轮重新核对后，确认应按“仓内已闭环”处理：

- `§8` 可扩展性架构：
  - 已有 `plugin SPI`、domain registry、plugin runtime、SDK/workbench 扩展面、workbench 聚合产品层。
  - 关键证据：`tests/integration/domains/registry/plugin-ecosystem-runtime-integration.test.ts`、`tests/integration/sdk/workbench-sdk-integration.test.ts`、`tests/integration/interaction/platform-workbench-integration.test.ts`
- `§32` 部署架构：
  - 已有 `environment readiness orchestration`、`deployment inventory`、OpenAPI/admin inventory surface、deployment integration 证据。
  - 关键证据：`tests/integration/stability/environment-readiness-orchestration-integration.test.ts`、`tests/unit/platform/shared/stability/deployment-inventory-service.test.ts`、`tests/unit/platform/interface/api/http-server/admin-routes.test.ts`
- `§33`、`§36`：
  - 章节本质为治理文档与成功标准，不要求独立运行时代码。
  - 当前已具 authoritative 文档入口与 docs health 测试，可按文档闭环处理。

---

## 5. 当前仅保留事项

以下事项继续保留，但不属于本轮 `R0-R6` 的仓内阻断：

- `I-1`：`S4 K8s` 集群级分片与真实多 Pod/多协调器闭环
- `II-3`：额外 LLM provider 丰富度扩展

说明：

- 上述项在本仓内仅维持 contract / inventory / readiness / smoke 证明。
- 它们不是当前 `review`、`todo`、`coverage-matrix` 中 `R0-R6` 未完成的理由。

---

## 6. 验证结果

本轮已完成的真实验证包括：

- `npm run build:test`
- 定向回归：
  - `dist/tests/integration/interaction/platform-workbench-integration.test.js`
  - `dist/tests/integration/stability/environment-readiness-orchestration-integration.test.js`
  - `dist/tests/integration/domains/registry/plugin-ecosystem-runtime-integration.test.js`
  - `dist/tests/unit/platform/shared/stability/deployment-inventory-service.test.js`
  - `dist/tests/unit/interaction/ux/platform-workbench-snapshot-service.test.js`
  - `dist/tests/unit/platform/interface/api/http-server/admin-routes.test.js`
  - `dist/tests/integration/platform/interface/api/api-resource-catalog-integration.test.js`
  - `dist/tests/golden/openapi-document.test.js`
- 全量回归：
  - `npm test` 过程中暴露的 `console-backend` 断言漂移已纳入本轮修复范围

---

## 7. 最终判定

结论固定为：

- `docs_zh/operations/current_todo_list.md` 中 `R0-R6` 已完成。
- `docs_zh/analysis/00-architecture-coverage-matrix.md` 应按本轮校正结果反映仓内真实闭环状态。
- 评审剩余事项仅为明确列出的仓外边界或后续增强项，不再视为当前仓内主线未完成。
