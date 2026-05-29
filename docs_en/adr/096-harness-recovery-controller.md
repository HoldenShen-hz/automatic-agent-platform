# ADR-096 Harness Recovery Controller

---

## OAPEFLIR 关联

- **Observe**: 接收 failure class型、checkpoint vs last decision
- **Assess**: 判断 recover / retry / abort / escalate
- **Plan**: 规划恢复路径vs repair boundary
- **Execute**: 应用恢复动作
- **Feedback**: record恢复证据和残余风险
- **Learn**: 沉淀failed模式到 learning pipeline
- **Improve**: 提升恢复策略
- **Release**: 恢复控制作为 durable-readiness 门禁

---

- Status：Accepted
- Decision日期：2026-04-23

## Background

Harness 的failed恢复不能relies oncall方自由决定，no则会破坏一致性vs审计。

## Decision

- `RecoveryController` 负责统一handle Harness failure
- 恢复动作必须based on checkpoint / durable run / decision state
- 恢复过程必须写 timeline vs recovery evidence

## Consequences

- failure handling 不再分散
- Replay、repair、resume 共享同一恢复模型
