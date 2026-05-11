# Connector Framework Contract

## 1. Scope

This contract defines the connector abstraction, lifecycle, health checks, and Connector SDK boundaries for `§57`.

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

- Connectors must only interact with the platform through the public SDK.
- Connector secrets, quotas, and network capabilities must be subject to policy / secret management constraints.
- Connector health check failures must not silently degrade to success.

## 8. Test Requirements

- unit: manifest validation, binding resolution, health mapping
- integration: connector runtime and callback path
- contract: unverified connectors must not receive production events