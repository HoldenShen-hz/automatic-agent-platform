# ADR-027 Security Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Background

Enterprise-class Agent platform handles sensitive data and critical business processes, must have complete security mechanisms: identity authentication, authorization, key management, data classification, and sandbox isolation.

## Decision

### 6 Principal Types

```typescript
type Principal =
  | { type: 'user'; user_id: string }
  | { type: 'service'; service_id: string }
  | { type: 'agent'; agent_id: string }
  | { type: 'worker'; worker_id: string }
  | { type: 'plugin'; plugin_id: string }
  | { type: 'system' };
```

### 3-Layer Authorization Model

1. RBAC (Role-Based Access Control)
2. Capability (capability list)
3. Context policy (based on environment, time, risk, and other factors)

### Secret Management

- Secret TTL ≤ 300s
- SecretManagementService (Vault/KMS) centralized management
- Key rotation 90 days

### 4-Layer Sandbox

| Layer | Mode | Description |
|-------|------|-------------|
| L1 | read_only | Read-only filesystem, no write permission |
| L2 | workspace_write | Only allowed to write to controlled workspace |
| L3 | scoped_external_access | Allows controlled external access, still constrained by scope |
| L4 | restricted_exec | Most strict execution mode, explicitly limits command capabilities |

Rules:

- There is no `SANDBOX_NONE` such as default-allow mode; platform defaults deny.
- Sandbox layers are governed by "writability / external access / execution capability", not by abstract "isolation intensity" custom naming.

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

Advantages:

- Multi-layer security protection covers main attack surfaces
- Short-term secret，降低泄露风险
- Sandbox isolation protects host system

Costs:

- Security checks add performance overhead
- Key management increases operations complexity

## Cross References

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-026 Risk Control Architecture](./026-risk-control-architecture.md)

## Source Sections

- `§11` Security architecture

## v4.3 ADR Remediation

- A-16: This ADR originally treated `pack / tenant` as principal types. The root cause was that security modeling mixed resource ownership objects and active calling subjects into one identity taxonomy. Fix: The text now converges canonical principal to `user / service / agent / worker / plugin / system`.
- A-17: This ADR originally used `SANDBOX_NONE / SANDBOX_READonly / SANDBOX_NETWORK_ISOLATED / SANDBOX_FULL`. The root cause was that early sandbox model was named by abstract intensity and did not switch to default-deny capability matrix with main architecture. Fix: The text now changes to `read_only / workspace_write / scoped_external_access / restricted_exec`, and removes `SANDBOX_NONE`.
