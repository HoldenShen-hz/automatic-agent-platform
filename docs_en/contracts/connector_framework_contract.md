# Connector Framework Contract

> Lifecycle note:
> connector 的 `registered/configured/verified/enabled/disabled/revoked` is connector 自身生命cycle，
> 不替代 `HarnessRun` / `NodeRun` 的 truth lifecycle。运lines时阶段对齐以 `harness_run_lifecycle_contract.md`
> 和 `lifecycle_and_termination_contract.md` 为准。

## 1. 范围

本 contract defines `§57` 的connect器抽象、生命cycle、健康检查vs Connector SDK 边界。

## 2. Canonical 对象

- `ConnectorManifest`
- `ConnectorBinding`
- `ConnectorExecutionRequest`
- `ConnectorExecutionResult`
- `ConnectorHealthReport`

## 3. `ConnectorManifest` 最小字段

- `connector_id`
- `provider`
- `capabilities`
- `auth_mode`
- `rate_limits`
- `supported_events`
- `lifecycle_state`

## 4. `ConnectorExecutionRequest` 最小字段

- `connector_id`
- `binding_id`
- `harness_run_id`
- `node_run_id?`
- `tenant_id`
- `operation`
- `parameters`
- `timeout_ms`
- `idempotency_key`

## 5. `ConnectorExecutionResult` 最小字段

- `connector_id`
- `binding_id`
- `harness_run_id`
- `node_run_id?`
- `operation`
- `status` (`success | failure | timeout | cancelled`)
- `output`
- `error_code?`
- `execution_duration_ms`
- `idempotency_key`

## 6. 生命cycle

- `registered`
- `configured`
- `verified`
- `enabled`
- `disabled`
- `revoked`

## 7. 规则

- connect器只能via公共 SDK vs平台交互。
- connect器key、配额vsnetwork能力必须受 policy / secret management 约束。
- connect器健康检查failed不得静默降级为success。

## 8. 测试要求

- unit：manifest validation、binding resolution、health mapping
- integration：connector runtime and callback path
- contract：未验证connect器不得接收生产事件
