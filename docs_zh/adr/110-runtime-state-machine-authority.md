# ADR-110: Runtime State Machine Authority

## 状态

Accepted

## 决策日期

2026-04-27

## 背景

v4.3 将 `HarnessRun`、`NodeRun`、`SideEffectRecord` 与 `BudgetLedger` 作为 P5 truth 的核心对象。若 P2、P3、P4、Recovery、HITL 或 operator 工具能直接写 truth 表，就无法保证终态封闭、CAS、lease、fencing、预算硬上限、副作用对账和审计事件同事务追加。

## 决策

1. `RuntimeStateMachine.transition(command)` 是以下对象状态推进的唯一正式入口：
   - `HarnessRun`
   - `NodeRun`
   - `NodeAttempt`
   - `SideEffectRecord`
   - `ReconciliationRecord`
   - `CompensationRecord`
   - `BudgetReservation`
   - `BudgetSettlement`
2. 所有 transition 必须在同一事务中完成：
   - 校验当前状态、目标状态与终态封闭规则。
   - 校验 CAS version、active lease、fencing token 与 `RunVersionLock`。
   - 校验 policy guard、budget precondition 与 side-effect safety。
   - 写入 truth mutation。
   - 追加 `platform.*` fact event。
   - 写入 audit / evidence 引用。
3. P2/P3/P4/Recovery/HITL 只能提交 `TransitionCommand`，不得直接更新 truth 表。
4. 旧 `StateCommand` / `StateMutationCommand` 只能作为内部兼容 wrapper；不得作为 public API 或新模块导出。

## 状态机原则

- 终态不可迁出；修复只能通过 redrive、compensation、GraphPatch、child run 或新 HarnessRun 追加表达。
- `retry_wait`、`awaiting_hitl`、`reconciling` 是非终态等待态，必须带 wake condition 或 external resolution record。
- budget reservation 与 settlement 必须遵守硬上限，不允许并发超订。
- side effect commit 前必须重校验 policy、budget、lease、fencing 与 human approval。

## 后果

- 运行时测试必须围绕 transition 矩阵、终态封闭、并发 CAS、budget hard cap 与 side-effect commit gate 建立。
- Storage repository 可以提供读写原语，但不能向业务层暴露绕过状态机的 truth mutation 方法。
- operator recovery 与 panic path 也必须提交 transition，除非进入只读 forensic 模式。

## 关联文档

- [109-contract-freeze.md](./109-contract-freeze.md)
- [runtime_state_machine_contract.md](../contracts/runtime_state_machine_contract.md)
- [harness-run-contract.md](../contracts/harness-run-contract.md)
- [node-run-attempt-receipt-contract.md](../contracts/node-run-attempt-receipt-contract.md)
