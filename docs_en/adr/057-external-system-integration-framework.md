# ADR-057 External System Integration Framework

- Status: Accepted
- Decision Date: 2026-04-20

## Context

The platform needs to integrate with external systems (CRM, ERP, project management tools, etc.), requiring a unified integration framework.

## Decision

### Integration Patterns

| Pattern | Description | Use Case |
|---------|-------------|----------|
| webhook | Event push | High real-time requirements |
| polling | Polling pull | No webhook on external system |
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
}
```

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
| retry | Retry |
| circuit_break | Circuit breaker |
| fallback | Degradation |
| dead_letter | Dead letter queue |

### Integration Governance

- Connector registration and discovery
- Authentication credential management
- Traffic control
- Audit logs

## Consequences

Advantages:

- Unified framework reduces integration costs
- Standardized error handling
- Governance capabilities ensure security

Costs:

- Adapter development takes time
- Maintaining multiple integrations increases complexity

## Cross-References

- [ADR-027 Security Architecture](./027-security-architecture.md)
- [ADR-021 Inter-Plane Communication Contract](./021-inter-plane-communication-contract.md)

## Source Section

- `§57` External System Integration Framework