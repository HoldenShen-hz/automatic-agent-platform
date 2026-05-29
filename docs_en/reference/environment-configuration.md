# Multi-Environment Configuration Differences

This document explains the responsibility boundaries of `config/environments/`, `config/runtime/`, `config/security/`, and `.env.example`, as well as the merge order of default values and environment overlays.

## Configuration Sources

- `config/environments/*.json`: Environment-level deployment parameters, such as cluster, namespace, image registry, and release strategy.
- `config/environments/default.json`: Non-sensitive default values shared across all environments; each environment file only overrides differing items.
- `config/runtime/*.json`: Runtime default values and environment overlays, such as timeout, rate limit, breaker, and drift reconciler.
- `config/runtime/default.json`: Runtime canonical default layer; `dev/test/staging/pre-prod/prod` only declare overrides.
- `config/security/*.json`: Security policy default values, such as approval, sandbox, authentication, and capability restrictions.
- `.env.example`: Local environment variable template, only allows empty values or non-sensitive placeholders.

## Merge Priority

1. `config/environments/default.json`
2. `config/environments/<env>.json`
3. `config/runtime/default.json`
4. `config/runtime/<env>.json`
5. `config/security/default.json`
6. `config/security/<env>.json`
7. Runtime environment variables

Notes:
- `runtime`/`security` merge in `default + overlay` mode; unoverridden fields continue to inherit default values.
- Only `environments`, `runtime`, `security` three directories are environment-layered; other `config/*` directories are not multi-environment coverage by default.
- `configVersion` / `configSchemaVersion` are based on runtime bundle; environment overlay can explicitly repeat declaration for convenient drift audit.

## Environment Definitions

| Environment | Purpose | Security Requirements |
|---|---|---|
| `dev` | Local development | May use minimal local dependencies, but must not commit real secrets |
| `test` | Automated testing | Behavior should be close to staging, test doubles allowed |
| `staging` | Pre-release verification | Close to production strategy, retain audit and approval |
| `pre-prod` | Pre-production rehearsal | Differences from production configuration must be explicitly recorded |
| `prod` | Production | Strict approval, real secret manager, complete audit |

## Change Rules

- New environment variables must sync update `.env.example` and related configuration documentation.
- New security fields must sync update all `config/security/*.json`, not just production.
- Environment differences must explain risks and verification commands in PR description.

## Current Runtime Environment Variable Catalog

The following variables are already documented in `.env.example` to avoid configuration samples and documentation drift after adding new runtime switches in code.

| Variable | Default Definition | Purpose |
|---|---|---|
| `AA_API_RATE_LIMIT_DISABLED` | `false` | Only local debugging allows disabling HTTP API default rate limiting. |
| `AA_API_RATE_LIMIT_REDIS` | empty | Configure API rate limiting to use Redis shared state; production recommendation is enabled. |
| `AA_API_RATE_LIMIT_WINDOW_MS` | `1000` | API rate limiting window length. |
| `AA_API_RATE_LIMIT_MAX_CALLS` | `100` | Maximum requests per API rate limiting window. |
| `AA_DB_PATH` | `./data/sqlite/automatic-agent-demo.db` (local example) | SQLite file path. Local stack can point to `data/sqlite/automatic-agent-dev.db`, container/Helm default usually points to `data/sqlite/automatic-agent.db`. |
| `AA_DLQ_PURGE_CONFIRM` | empty | Secondary confirmation variable for dangerous DLQ purge operation; needs to be used with `--yes`. |
| `AA_LOGIN_TOKEN` | empty | Short-term token readable by CLI login flow; only for interactive or controlled automation scenarios. |
| `AA_OPENAPI_PUBLIC` | `0` | OpenAPI JSON requires authentication by default, only becomes public when explicitly set to `1`. |
| `AA_MODEL_PROVIDER_FALLBACK_MODELS` | empty | Candidate fallback model list after non-streaming model call failure. |
| `AA_MODEL_CALL_RETRY_MAX_ATTEMPTS` | `2` | Maximum retry attempts for model calls. |
| `AA_MODEL_CALL_RETRY_BASE_DELAY_MS` | `100` | Initial backoff for model call retries. |
| `AA_ALLOW_IN_MEMORY_SESSION_STORE` | `0` | Production environment defaults to prohibiting IAM session from using in-process memory storage. |
| `AA_ALLOW_IN_MEMORY_SERVICE_IDENTITY_STORE` | `0` | Production environment defaults to prohibiting service identity from using in-process memory storage. |

## Naming and Exceptions

- `config/conversation/templates.json` is a template registry table, not a single default layer, so it does not use `default.json` naming.
- `config/providers/models.json` is a locally editable model directory; `models.bundled.json` is the baseline snapshot shipped with the repository package.
- `config/validation/mission-operating-model-metric-alert-policy.yaml` retains YAML because this file is mainly maintained by humans according to policy text.

## Audit Evidence

`scripts/ci/audit-review-batch-resource-contracts.mjs` validates that the above variables simultaneously appear in `.env.example`, this documentation, and corresponding runtime code; when adding new variables, must extend this audit, not just change single point files.