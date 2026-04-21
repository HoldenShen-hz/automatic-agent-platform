# ADR-027 Security Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

Enterprise-class Agent platforms handle sensitive data and critical business processes and must have comprehensive security mechanisms: authentication, authorization, key management, data classification, and sandbox isolation.

## Decision

### 6 Principal Types

```typescript
type Principal =
  | { type: 'user'; user_id: string }
  | { type: 'service'; service_id: string }
  | { type: 'agent'; agent_id: string }
  | { type: 'pack'; pack_id: string }
  | { type: 'tenant'; tenant_id: string }
  | { type: 'system' };
```

### 3-Layer Authorization Model

1. RBAC (Role-Based Access Control)
2. Capability (Capability list)
3. Context Policy (based on environment, time, risk, etc.)

### Secret Management

- Secret TTL ≤ 300s
- SecretManagementService (Vault/KMS) centralized management
- Key rotation every 90 days

### 4-Layer Sandbox

| Layer | Mode | Description |
|-------|------|-------------|
| L1 | SANDBOX_NONE | No restrictions |
| L2 | SANDBOX_READONLY | Read-only filesystem |
| L3 | SANDBOX_NETWORK_ISOLATED | Network isolated |
| L4 | SANDBOX_FULL | Fully isolated |

### Data Classification

| Level | Description |
|-------|-------------|
| public | Public data |
| internal | Internal data |
| confidential | Confidential data |
| restricted | Strictly restricted |

### Encryption Requirements

- TLS 1.3 transport encryption
- PII fields AES-256 encryption
- Vault/KMS key storage

## Consequences

Positive:
- Multi-layer security coverage addresses main attack surfaces
- Short-lived secrets reduce leak risk
- Sandbox isolation protects host systems

Negative:
- Security checks add performance overhead
- Key management increases operational complexity

Trade-offs:
- Security vs. performance
- Compliance vs. flexibility

## Cross-References

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-026 Risk Control Architecture](./026-risk-control-architecture.md)

## Source Sections

- `§11` Security and Reliability Architecture