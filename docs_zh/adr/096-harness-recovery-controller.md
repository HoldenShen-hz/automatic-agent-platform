# ADR-096 Harness Recovery Controller

---

## OAPEFLIR 关联

- **Observe**: 接收 failure 类型、checkpoint 与 last decision
- **Assess**: 判断 recover / retry / abort / escalate
- **Plan**: 规划恢复路径与 repair boundary
- **Execute**: 应用恢复动作
- **Feedback**: 记录恢复证据和残余风险
- **Learn**: 沉淀失败模式到 learning pipeline
- **Improve**: 提升恢复策略
- **Release**: 恢复控制作为 Ring 2 durable-readiness 门禁

---

- 状态：Accepted
- 决策日期：2026-04-23

## 背景

Harness 的失败恢复不能依赖调用方自由决定，否则会破坏一致性与审计。

## 决策

- `RecoveryController` 负责统一处理 Harness failure
- 恢复动作必须基于 checkpoint / durable run / decision state
- 恢复过程必须写 timeline 与 recovery evidence

## 后果

- failure handling 不再分散
- Replay、repair、resume 共享同一恢复模型

## v4.3 ADR Remediation

- R10-45: 本 ADR 原先使用 `phase 8b` 作为恢复控制交付门禁术语，已修复为 `Ring 2 durable-readiness`，符合 §33 ring 口径废弃 Phase 1-9 的要求。
