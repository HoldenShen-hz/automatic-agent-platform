# Security Baseline Contract

## 1. Scope

Defines default security baseline: identity, network, keys, log sanitization, and dependency constraints.

## 2. Baseline Rules

- All write requests must carry identity, idempotency, and audit context.
- Secrets are only permitted to be used via secret provider/bridge; must not be written to disk in plaintext.
- Defaults to deny external network, external commands, and high-risk side effects.
- Logs and metrics must differentiate user-facing vs internal-facing sensitive fields.