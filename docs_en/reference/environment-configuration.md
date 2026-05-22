# Multi-Environment Configuration Differences

This document explains the responsibility boundaries of `config/environments/`, `config/security/`, and `.env.example`.

## Configuration Sources

- `config/environments/*.json`: Environment-level runtime parameters, such as region, profile, and service switches.
- `config/environments/default.json`: Shared non-secret defaults for every environment; each environment file should only override environment-specific fields.
- `config/security/*.json`: Security policy defaults, such as approval, sandbox, authentication, and capability limits.
- `.env.example`: Local environment variable template, allowing only empty values or non-sensitive placeholders.

## Environment Scope

| Environment | Purpose | Security Requirements |
|---|---|---|
| `dev` | Local development | May use minimal local dependencies, but must not commit real secrets |
| `test` | Automated testing | Behavior should be close to staging, test doubles are allowed |
| `staging` | Pre-release verification | Close to production policy, audit and approval are retained |
| `pre-prod` | Pre-production rehearsal | Differences from production configuration must be explicitly documented |
| `prod` | Production | Strict approval, real secret manager, complete audit |

## Change Rules

- New environment variables must simultaneously update `.env.example` and related configuration documentation.
- New security fields must simultaneously update all `config/security/*.json`, not just production.
- Environment differences must explain risk and verification commands in the PR description.

## Current Runtime Environment Variable Registry

The following variables are already documented in `.env.example` to avoid configuration sample and documentation drift after new runtime switches are added to the code.

| Variable | Default Scope | Purpose |
|---|---|---|
| `AA_API_RATE_LIMIT_DISABLED` | `false` | Only local debugging allows disabling default HTTP API rate limiting. |
| `AA_API_RATE_LIMIT_REDIS` | empty | Configure API rate limiting using Redis shared state; recommended to enable in production. |
| `AA_API_RATE_LIMIT_WINDOW_MS` | `1000` | API rate limiting window duration. |
| `AA_API_RATE_LIMIT_MAX_CALLS` | `100` | Maximum requests within API rate limiting window. |
| `AA_OPENAPI_PUBLIC` | `0` | OpenAPI JSON requires authentication by default, only becomes public when explicitly set to `1`. |
| `AA_MODEL_PROVIDER_FALLBACK_MODELS` | empty | Candidate fallback model list after non-streaming model call failures. |
| `AA_MODEL_CALL_RETRY_MAX_ATTEMPTS` | `2` | Maximum retry attempts for model calls. |
| `AA_MODEL_CALL_RETRY_BASE_DELAY_MS` | `100` | Initial backoff for model call retries. |
| `AA_ALLOW_IN_MEMORY_SESSION_STORE` | `0` | Production environments prohibit IAM sessions from using in-process memory storage by default. |
| `AA_ALLOW_IN_MEMORY_SERVICE_IDENTITY_STORE` | `0` | Production environments prohibit service identity from using in-process memory storage by default. |

## Audit Evidence

`scripts/ci/audit-review-batch-resource-contracts.mjs` validates that the above variables appear simultaneously in `.env.example`, this documentation, and the corresponding runtime code; when adding new variables, this audit must be expanded, and single-point file changes alone are not acceptable.
