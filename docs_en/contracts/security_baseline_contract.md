# Security Baseline Contract

## 1. Scope

Defines default security baseline: identity, network, secrets, log masking, and dependency constraints.

## 2. Baseline Rules

- All write requests must carry identity, idempotency, and audit context.
- Secrets only allowed through secret provider/bridge, must not be written to disk in plaintext.
- Default deny external network, external commands, and high-risk side effects.
- Logs and metrics must distinguish user-facing vs internal plane sensitive fields.
