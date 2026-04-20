# Workflow Debugger Contract

## 1. 范围

本 contract 定义 `§65` 的执行流调试、断点 API 和运行对比。

## 2. Canonical 对象

- `WorkflowTraceFrame`
- `BreakpointDefinition`
- `BreakpointHit`
- `RunComparisonReport`

## 3. `BreakpointDefinition` 最小字段

- `breakpoint_id`
- `workflow_id`
- `step_selector`
- `condition`
- `action`: `pause | snapshot | compare`

## 4. 规则

- 调试动作不得改变业务输出的 authoritative 事实记录。
- 比较报告必须基于可重放证据，而不是 UI 临时状态。
- 生产调试必须受审批和权限控制。

## 5. 测试要求

- unit：breakpoint matching、trace frame normalization
- integration：runtime trace -> debugger -> replay/compare
- contract：未授权用户不得设置生产断点

