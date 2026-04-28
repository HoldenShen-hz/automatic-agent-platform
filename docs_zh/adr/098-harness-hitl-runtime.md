# ADR-098 Harness HITL Runtime

---

## OAPEFLIR 关联

- **Observe**: 识别人工介入触发条件与证据
- **Assess**: 选择 approve / reject / continue / abort
- **Plan**: 形成 HITL request 与 resume boundary
- **Execute**: 暂停 run 并等待人工输入
- **Feedback**: 记录人工决策和责任链
- **Learn**: 汇总高频 HITL 触发原因
- **Improve**: 优化自动化边界
- **Release**: HITL 是 runtime primitive，不是旁路机制

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

架构文档要求 HITL 成为 Harness 原生步骤类型，而不是只在异常场景里临时升级。

## 决策

- HITL 作为 Harness 原生 runtime step
- `NodeRun` 进入 `awaiting_hitl` 时必须有正式 request 与 evidence refs
- 任何人工 resolution 都必须写审计和 timeline

## 后果

- 人工协作从外围审批升级为主链能力

## v4.3 ADR Remediation

- A-26: 本 ADR 原先使用 `waiting_hitl`，根因是早期命名沿用了旧 harness 草案，没有随着 canonical `NodeRun.status` 枚举统一到 `awaiting_hitl`。修复：正文现改为 `NodeRun -> awaiting_hitl`。
