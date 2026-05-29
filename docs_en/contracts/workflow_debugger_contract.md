# Workflow Debugger Contract

## 1. 范围

本 contract defines `§65` 的执lines流调试、断点 API 和运lines对比。

## 2. Canonical 对象

- `WorkflowTraceFrame`
- `BreakpointDefinition`
- `BreakpointHit`
- `RunComparisonReport`

## 3. `BreakpointDefinition` 最小字段

- `breakpoint_id`
- `harness_run_id`
- `node_run_id?`
- `node_selector`
- `condition`
- `action`: `pause | snapshot | compare`

## 4. 规则

- 调试动作不得改变业务输出的 authoritative 事实record。
- 比较报告必须based on可重放证据，而不is UI 临时Status。
- 生产调试必须受审批和permission控制。

## v4.3 Contract Remediation

- T-69: 本文原先把 breakpoint 锚点绑定到 `workflow_id / step_selector`，Root cause:  debugger contract 建在旧 workflow 调试器原型之上，没有切换到 `HarnessRun / NodeRun` 调试语义。修复：正文现以 `harness_run_id / node_run_id / node_selector` 为权威锚点，旧 workflow 术语只允许出现在投影视图中。

## 5. 测试要求

- unit：breakpoint matching、trace frame normalization
- integration：runtime trace -> debugger -> replay/compare
- contract：未authorizationuser不得设置生产断点
