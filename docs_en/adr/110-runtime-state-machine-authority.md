# ADR-110: Runtime State Machine Authority

- Status：Accepted
- Decision日期：2026-04-27

## Background

v4.3 将 `HarnessRun`、`NodeRun`、`SideEffectRecord` vs `BudgetLedger` 作为 P5 truth 的核心对象。若 P2、P3、P4、Recovery、HITL 或 operator 工具能directly写 truth table，就no法保证终态封闭、CAS、lease、fencing、budget硬upper limit、副作用对账和审计事件同事务追加。

## Decision

1. `RuntimeStateMachine.transition(command)` is以下对象Status推进的唯一正式入口：
   - `HarnessRun`
   - `NodeRun`
   - `NodeAttempt`
   - `SideEffectRecord`
   - `ReconciliationRecord`
   - `CompensationRecord`
   - `BudgetReservation`
   - `BudgetSettlement`
2. 所有 transition 必须在同一事务中完成：
   - 校验当前Status、目标Statusvs终态封闭规则。
   - 校验 CAS version、active lease、fencing token vs `RunVersionLock`。
   - 校验 policy guard、budget precondition vs side-effect safety。
   - writes truth mutation。
   - 追加 `platform.*` fact event。
   - writes audit / evidence references用。
3. P2/P3/P4/Recovery/HITL 只能提交 `TransitionCommand`，不得directly更新 truth table。
4. 旧 `StateCommand` / `StateMutationCommand` 只能作为内部兼容 wrapper；不得作为 public API 或新模块export。

## Status机principle

- 终态不可迁出；修复只能via redrive、compensation、GraphPatch、child run 或新 HarnessRun 追加table达。
- `retry_wait`、`awaiting_hitl`、`reconciling` is非终态等待态，必须带 wake condition 或 external resolution record。
- budget reservation vs settlement 必须遵守硬upper limit，不允许concurrentexceeds订。
- side effect commit 前必须重校验 policy、budget、lease、fencing vs human approval。

## Consequences

- 运lines时测试必须围绕 transition 矩阵、终态封闭、concurrent CAS、budget hard cap vs side-effect commit gate 建立。
- Storage repository 可以提供读写原语，但不能向业务层暴露bypassingStatus机的 truth mutation 方法。
- operator recovery vs panic path 也必须提交 transition，除非进入只读 forensic 模式。

## 关联文档

- [109-contract-freeze.md](./109-contract-freeze.md)
- [runtime_state_machine_contract.md](../contracts/runtime_state_machine_contract.md)
- [harness-run-contract.md](../contracts/harness-run-contract.md)
- [node-run-attempt-receipt-contract.md](../contracts/node-run-attempt-receipt-contract.md)
