# Configuration Contract

Configuration is split by concern. Do not add new config files without a clear owner and validation path.

## Layout

- `config/environments/`: environment identity, deployment profile, and non-secret runtime defaults.
- `config/security/`: approval, sandbox, capability, and authentication policy defaults.
- `config/runtime/`: runtime tuning such as timeouts, retries, rate limits, queues, and circuit breakers.
- `.env.example`: local environment variable template; values must remain empty or non-secret placeholders.

## Rules

- Production secrets must come from the secret manager or deployment environment.
- New security fields must be represented across all relevant `config/security/*.json` files.
- New runtime fields must have default, test, staging/pre-prod, and prod behavior reviewed.
- Environment differences must be documented in `docs_zh/reference/environment-configuration.md`.
- Shared environment defaults belong in `config/environments/default.json`; per-environment files should only override environment-specific fields.

## Validation

Use targeted config/golden tests for config changes. Do not rely on a full test run as the only proof for config correctness.
