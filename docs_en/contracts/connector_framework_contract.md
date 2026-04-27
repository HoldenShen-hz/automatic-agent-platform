# Connector Framework Contract

## 1. Scope

This contract defines connector abstraction, lifecycle, health check, and Connector SDK boundaries for `§57`.

## 2. Canonical Objects

- `ConnectorManifest`
- `ConnectorBinding`
- `ConnectorExecutionRequest`
- `ConnectorExecutionResult`
- `ConnectorHealthReport`

## 3. ConnectorManifest Minimum Fields

- `connector_id`
- `provider`
- `capabilities`
- `auth_mode`
- `rate_limits`
- `supported_events`
- `lifecycle_state`

## 4. Lifecycle

- `registered`
- `configured`
- `verified`
- `enabled`
- `disabled`
- `revoked`

## 5. Rules

- Connectors can only interact with the platform through public SDK.
- Connector secrets, quotas, and network capabilities must be constrained by policy / secret management.
- Connector health check failures must not silently degrade to success.

## 6. Test Requirements

- unit: manifest validation, binding resolution, health mapping
- integration: connector runtime and callback path
- contract: unverified connectors must not receive production events
