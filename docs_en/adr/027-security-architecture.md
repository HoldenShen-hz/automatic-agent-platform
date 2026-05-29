# ADR-027 Security and Reliability Architecture

- Status：Accepted
- Decision Date：2026-04-03

## Background

Enterprise-class Agent platforms handle sensitive data and critical business processes, requiring comprehensive security mechanisms: identity authentication, authorization, key management, data classification, and sandbox isolation.

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
2. Capability (Capability list)
3. Context Policy (Based on environment, time, risk and other factors)

### Secret Management

- Secret TTL ≤ 300s
- SecretManagementService (Vault/KMS) centralized management
- Key rotation every 90 days

### 4-Layer Sandbox

| Level | Mode | Description |
|------|------|------|
| L1 | read_only | Read-only filesystem, no write permission |
| L2 | workspace_write | Only allows writing to controlled workspace |
| L3 | scoped_external_access | Allows controlled external access, still subject to scope constraints |
| L4 | restricted_exec | Most strict execution mode, explicitly restricts command capabilities |

Rules:

- There is no `SANDBOX_NONE` default-allow mode; platform defaults to deny.
- Sandbox levels are governed by "writability / external access / execution capability", not abstract "isolation strength" naming.

### Data Classification

| Level | Description |
|------|------|
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

- Multi-layer security coverage protects major attack surfaces
- Short-lived secrets reduce leakage risk
- Sandbox isolation protects host system

Costs:

- Security checks add performance overhead
- Key management increases operational complexity

## Cross-references

- [ADR-005 Security Model](./005-security-model.md)
- [ADR-026 Risk Control Architecture](./026-risk-control-architecture.md)

## Source Section

- `§11` Security and Reliability Architecture

## v4.3 ADR Remediation

- A-16: This ADR originally treated `pack / tenant` as principal types, root cause: security modeling mixed resource ownership objects and active call principals into one identity taxonomy. Fix: The body now converges canonical principal to `user / service / agent / worker / plugin / system`.
- A-17: This ADR originally used `SANDBOX_NONE / SANDBOX_READonly / SANDBOX_NETWORK_ISOLATED / SANDBOX_FULL`, root cause: the early sandbox model was named by abstract strength and did not switch to the default-deny capability matrix with the main architecture. Fix: The body now changes to `read_only / workspace_write / scoped_external_access / restricted_exec`, and removes `SANDBOX_NONE`.