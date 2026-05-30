# Connector Framework Contract

> Lifecycle note:
> Connector's `registered/configured/verified/enabled/disabled/revoked` is the connector's own lifecycle,
> and does not replace `HarnessRun` / `NodeRun` truth lifecycle. Runtime stage alignment follows `harness_run_lifecycle_contract.md`
> and `lifecycle_and_termination_contract.md`.

## 1. Scope

This contract defines `§57`'s connector abstraction, lifecycle, health check, and Connector SDK boundaries.

## 2. Canonical Objects

- `ConnectorManifest`
- `ConnectorBinding`
- `ConnectorExecutionRequest`
- `ConnectorExecutionResult`
- `ConnectorHealthReport`

## 3. `ConnectorManifest` Minimum Fields

- `connector_id`
- `provider`
- `capabilities`
- `auth_mode`
- `rate_limits`
- `supported_events`
- `lifecycle_state`

## 4. `ConnectorExecutionRequest` Minimum Fields

- `connector_id`
- `binding_id`
- `harness_run_id`
- `node_run_id?`
- `tenant_id`
- `operation`
- `parameters`
- `timeout_ms`
- `idempotency_key`

## 5. `ConnectorExecutionResult` Minimum Fields

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

## 6. Lifecycle

- `registered`
- `configured`
- `verified`
- `enabled`
- `disabled`
- `revoked`

## 7. Rules

- Connectors can only interact with the platform through public SDK.
- Connector keys, quotas, and network capabilities must be constrained by policy / secret management.
- Connector health check failures must not silently degrade to success.

## 8. Testing Requirements

- unit: manifest validation, binding resolution, health mapping
- integration: connector runtime and callback path
- contract: unverified connectors must not receive production events