# Multi-Environment Configuration Differences

This document explains the responsibility boundaries of `config/environments/`, `config/runtime/`, `config/security/`, and `.env.example`, together with the merge order between defaults and environment overlays.

## Configuration Sources

- `config/environments/*.json`: Environment-level deployment parameters such as cluster, namespace, image repository, and rollout profile.
- `config/environments/default.json`: Shared non-secret defaults for every environment; each environment file should only override environment-specific fields.
- `config/runtime/*.json`: Runtime defaults and environment overlays such as timeouts, rate limits, breakers, and drift reconciliation.
- `config/runtime/default.json`: Canonical runtime baseline; `dev/test/staging/pre-prod/prod` only declare overrides.
- `config/security/*.json`: Security policy defaults, such as approval, sandbox, authentication, and capability limits.
- `.env.example`: Local environment variable template, allowing only empty values or non-sensitive placeholders.

## Merge Precedence

1. `config/environments/default.json`
2. `config/environments/<env>.json`
3. `config/runtime/default.json`
4. `config/runtime/<env>.json`
5. `config/security/default.json`
6. `config/security/<env>.json`
7. Runtime environment variables

Notes:

- `runtime` and `security` use `default + overlay` merging; fields that are not overridden continue to inherit the default values.
- Only `environments`, `runtime`, and `security` are environment-layered directories. Other `config/*` directories are canonical concern-scoped defaults or registries by default.
- `configVersion` and `configSchemaVersion` belong to the runtime bundle contract; overlays may repeat them explicitly to make drift reviews easier.

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
| `AA_DB_PATH` | `./data/sqlite/automatic-agent-demo.db` (local example) | SQLite file path. Local stacks may point at `data/sqlite/automatic-agent-dev.db`, while container/Helm defaults usually use `data/sqlite/automatic-agent.db`. |
| `AA_DLQ_PURGE_CONFIRM` | empty | Second-factor confirmation variable for destructive DLQ purge operations; must be paired with `--yes`. |
| `AA_LOGIN_TOKEN` | empty | Short-lived token consumed by the CLI login flow; restrict it to interactive or tightly controlled automation. |
| `AA_OPENAPI_PUBLIC` | `0` | OpenAPI JSON requires authentication by default, only becomes public when explicitly set to `1`. |
| `AA_MODEL_PROVIDER_FALLBACK_MODELS` | empty | Candidate fallback model list after non-streaming model call failures. |
| `AA_MODEL_CALL_RETRY_MAX_ATTEMPTS` | `2` | Maximum retry attempts for model calls. |
| `AA_MODEL_CALL_RETRY_BASE_DELAY_MS` | `100` | Initial backoff for model call retries. |
| `AA_ALLOW_IN_MEMORY_SESSION_STORE` | `0` | Production environments prohibit IAM sessions from using in-process memory storage by default. |
| `AA_ALLOW_IN_MEMORY_SERVICE_IDENTITY_STORE` | `0` | Production environments prohibit service identity from using in-process memory storage by default. |

## Naming And Exceptions

- `config/conversation/templates.json` is a template registry, not a single mergeable default layer, so it intentionally does not use the `default.json` name.
- `config/providers/models.json` is the locally editable model catalog; `models.bundled.json` is the repository-bundled baseline snapshot.
- `config/validation/mission-operating-model-metric-alert-policy.yaml` intentionally stays YAML because it is maintained as human-reviewed policy text.

## Audit Evidence

`scripts/ci/audit-review-batch-resource-contracts.mjs` validates that the above variables appear simultaneously in `.env.example`, this documentation, and the corresponding runtime code; when adding new variables, this audit must be expanded, and single-point file changes alone are not acceptable.
