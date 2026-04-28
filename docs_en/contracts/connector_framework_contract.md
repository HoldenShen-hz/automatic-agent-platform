# Connector Framework Contract

## 1. Scope

This contract defines `§57`'s connector abstraction, lifecycle, health checks, and Connector SDK boundaries.

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

- Connectors must only interact with the platform through the public SDK.
- Connector secrets, quotas, and network capabilities must be subject to policy / secret management constraints.
- Connector health check failures must not silently degrade to success.

## 6. Testing Requirements

- unit: manifest validation, binding resolution, health mapping
- integration: connector runtime and callback path
- contract: unverified connectors must not receive production events
