# ADR-057 External System Integration Framework

- Status: Accepted
- Decision Date: 2026-04-20

## Context

The platform needs to integrate with external systems (CRM, ERP, project management tools, etc.) and requires a unified integration framework.

## Decision

### Integration Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| webhook | Event push | High real-time requirements |
| polling | Poll pulling | No webhook on external system |
| api_proxy | API proxy | Requires authentication and transformation |
| file_transfer | File transfer | Bulk data exchange |

### Adapter Framework

```typescript
interface ExternalAdapter {
  adapter_id: string;
  system_type: string;
  auth_config: AuthConfig;
  endpoints: Endpoint[];
  transform_rules: TransformRule[];
  error_handling: ErrorStrategy;
  side_effect_policy: SideEffectPolicy; // Must associate with SideEffectRecord, see §14.5
  // X1 Reliability Fabric integration (must not be reimplemented locally)
  retryable?: boolean;                  // Executed by X1 RetryMiddleware
  circuit_breaker_config?: CircuitBreakerConfig; // Executed by X1 CBMiddleware
}
```

All external system calls must be recorded via SideEffectRecord (§14.5 / §25) to track external side effect lifecycle. The Adapter's `side_effect_policy` declares `proposed→confirmed` state machine transition conditions, unified progression by RuntimeStateMachine, must not be submitted by Adapter itself.

**X1 Reliability Fabric Mandatory Integration**:
- `retry` logic is executed by X1 RetryMiddleware (library interceptor), Adapter must not reimplement locally
- `circuit_break` is executed by X1 CircuitBreakerMiddleware, Adapter only needs to declare `circuit_breaker_config`
- Adapter level is prohibited from calling `setTimeout`, `setInterval` or any retry loops
- SideEffectRecord's `compensation` field must associate with X1 Reliability Fabric's fallback strategy

### Authentication Types

| Type | Description |
|------|-------------|
| api_key | API Key |
| oauth2 | OAuth 2.0 |
| basic_auth | Username/password |
| jwt | JWT Token |

### Error Handling

| Strategy | Description |
|----------|-------------|
| retry | Retry (should be provided uniformly by X1 Reliability Fabric library/middleware, Adapter should not reimplement locally) |
| circuit_break | Circuit break (should be provided uniformly by X1 Reliability Fabric library/middleware, see §4.7 X1 Reliability & Security Fabric) |
| fallback | Degradation |
| dead_letter | Dead letter queue |

Note: retry and circuit_break are platform-level cross-cutting concerns. §4.7 X1 Reliability Fabric requires implementation as library interceptors, must not be reimplemented locally in each Adapter. Adapter only needs to declare `retryable: boolean` and `circuit_breaker_config`, actual strategy executed by X1 middleware.

### Integration Governance

- Connector registration and discovery
- Authentication credential management
- Traffic control
- Audit logging

## Consequences

Positive:

- Unified framework reduces integration cost
- Standardized error handling
- Governance capabilities ensure security

Negative:

- Adapter development takes time
- Maintaining multiple integrations increases complexity

## Cross-References

- [ADR-027 Security Architecture](./027-security-architecture.md)
- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)
- [§4.7 X1 Reliability & Security Fabric](../architecture/00-platform-architecture.md#47-x1-reliability--security-fabric) (retry/circuit_break middleware/library-level requirements)
- [§14.5 NodeRun SideEffectRecord](../architecture/00-platform-architecture.md#1410-noderun-state-machine) (external side effect lifecycle management)
- [ADR-101 Domain Risk Profile](./101-domain-risk-override-platform-default.md) (SideEffect compensation policy binding)

## Source Section

- `§57` External System Integration Framework
