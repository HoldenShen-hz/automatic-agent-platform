# Connector Framework Contract

## 1. 范围

本 contract 定义 `§57` 的连接器抽象、生命周期、健康检查与 Connector SDK 边界。

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

## 6. 生命周期

- `registered`
- `configured`
- `verified`
- `enabled`
- `disabled`
- `revoked`

## 7. 规则

- 连接器只能通过公共 SDK 与平台交互。
- 连接器密钥、配额与网络能力必须受 policy / secret management 约束。
- 连接器健康检查失败不得静默降级为成功。

## 8. 测试要求

- unit：manifest validation、binding resolution、health mapping
- integration：connector runtime and callback path
- contract：未验证连接器不得接收生产事件

