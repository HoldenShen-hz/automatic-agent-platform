# 代码库 vs 架构设计审查报告

> 审查日期：2026-04-20
>
> 审查基线：
>
> - `docs_zh/automatic_agent_patform_arthitecture_design.md`
> - `docs_zh/code_struct_design.md`
> - `docs_zh/reviews/architecture_v2_7_coverage_matrix.md`

## 1. 结论

当前代码库已经不再符合“Layer 3-7 大量是 skeleton、§5 契约全部未实现、`src/core/` 仍承载真实 runtime 实现”这一类旧结论。

当前更准确的判断是：

- 七层目录结构已稳定存在，并且上层五个能力域都已形成 ADR -> contract -> src -> tests 的主闭环。
- `docs_zh/reviews/architecture_v2_7_coverage_matrix.md` 已成为 authoritative 覆盖入口；大多数 v2.7 章节状态是 `exists`，剩余缺口主要集中在 `partial`，而不是 `missing` 或 `skeleton`。
- `src/core/runtime/` 已收敛为兼容性 shim；canonical 多步编排实现位于 `src/platform/execution/execution-engine/`。

## 2. 本轮确认已完成的收敛

### 2.1 架构与文档闭环

- ADR 已连续扩展到 `090`
- v2.7 authoritative contracts 已按能力域补齐
- 覆盖矩阵已建立 `architecture chapter -> ADR -> contract -> src -> tests` 的全量映射

### 2.2 代码结构整理

以下整理项已在当前代码库完成：

- `src/platform/execution/execution-engine/` 补齐了目录级 `index.ts`
- `src/domains/governance/`
- `src/interaction/ux/`
- `src/org-governance/*` 五个二级目录
- `src/scale-ecosystem/*` 五个二级目录
- `src/ops-maturity/*` 十个二级目录
- `src/sdk/cli/index.ts`
- `src/platform/interface/ingress/index.ts` 已正确导出两个限流器模块

### 2.3 `core/runtime` 收敛状态

当前 `src/core/runtime/` 的定位已经从“残留真实实现”变成“兼容性 re-export 层”：

- `orchestrator/index.ts` → re-export `src/platform/execution/execution-engine/multi-step-orchestration.ts`
- `orchestrator/types.ts` → re-export `multi-step-orchestration-types.ts`
- `planner/index.ts` → re-export agent round loop / tool definitions / utils
- `supervisor/index.ts` → re-export `multi-step-supervisor.ts`

同时，`src/platform/` 与 `tests/` 中已经没有直接导入 `core/runtime/*` 的路径残留。

## 3. 当前状态应以覆盖矩阵为准

请以 [architecture_v2_7_coverage_matrix.md](./architecture_v2_7_coverage_matrix.md) 作为当前状态入口。按该矩阵，以下章节已经形成 `exists` 闭环：

- `§37-§44` 中除 `§44` 外的上层领域 / interaction 章节
- `§46-§57`
- `§59-§69`
- `§14-§19`
- `§24-§26`

## 4. 当前真实缺口

当前真实缺口不再是“大量 missing”，而是以下 `partial` 章节仍有继续加深空间：

- `§6-§8`
  - API 资源粒度、通信拓扑、扩展生态运行面的章节级覆盖仍偏轻
- `§16-§17`
  - 已补平台级 prompt release orchestration 与 dataset / judge gate，剩余缺口主要是 staged canary、judge 市场和更完整在线监控生态
- `§20-§23`
  - 长时 workflow、HITL 通知与 takeover UI、SDK 工作台仍有产品层缺口；合规已补跨区导出与删除请求编排，但法规专题包仍不够厚
- `§29`
  - learning signals -> validated learning objects -> knowledge/evolution memory 的编排已补齐，但 Learn -> Improve -> Approval -> Rollout 的更深治理链仍待继续压实
- `§30`
  - pack/plugin 兼容性清单、license tier 判定、builtin plugin coverage，以及 pack development -> testing -> certification -> publish -> deprecate 生命周期已补齐，但 registry/marketplace 的更深联动仍可继续增强
- `§27-§32`
  - 已补 environment readiness / SLO / resource pool / failover drill 编排，以及 event/projection/DLQ inventory；剩余缺口主要是 benchmark inventory、coordinator 级恢复细节、deployment 资源台账厚度和完整 projection 清单
- `§33`、`§36`
  - 本质上是治理 / 成功标准章节，天然以文档和 contract 为主
- `§44`
  - UX orchestration 已实现，但 UI 产品细节与 WCAG 等非代码规范仍未完全展开

## 5. 文档一致性回归结果

本轮已修正以下过时入口文档中的旧路径引用：

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `MEMORY.md`
- `MIGRATION_BASELINE.md`
- `src/README.md`

这些入口文档现在统一指向当前七层结构，而不是旧的 `src/core/` / `src/cli/` / `src/gateway/` 形态。

## 6. 后续建议

如果继续推进，优先级应当是：

1. 按覆盖矩阵继续压缩 `partial` 章节，而不是重复做目录重组。
2. 对 `§6-§8`、`§20-§23`、`§27-§32` 分批补更真实的业务流与专题测试。
3. 等外部消费者彻底迁移完毕后，再评估是否删除 `src/core/runtime/` shim 层。
