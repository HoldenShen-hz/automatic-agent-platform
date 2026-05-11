# Security Baseline Contract

## 1. Scope

Defines the default security baseline: identity, network, secrets, log redaction, and dependency constraints.

## 2. Baseline Rules

- All write requests must carry identity, idempotency, and audit context.
- Secrets are only permitted via secret provider/bridge and must never be written to disk in plaintext.
- External network, external commands, and high-risk side effects are denied by default.
- Logs and metrics must distinguish between user-facing and internal-plane sensitive fields.
