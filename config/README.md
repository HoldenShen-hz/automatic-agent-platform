# Configuration Contract

Configuration is split by concern. Do not add new files or new layering rules without a clear owner, merge model, and validation path.

## Layout

| Path | Responsibility | Layering Model |
| --- | --- | --- |
| `config/bootstrap/` | bootstrap order, readiness, rollout bootstrap gates | canonical defaults only |
| `config/constitution/` | platform constitution and governance defaults | canonical defaults only |
| `config/conversation/` | NL conversation templates | named template registry |
| `config/cost-alert/` | cost alert defaults | canonical defaults only |
| `config/domains/` | domain baseline catalog and domain-specific bundles | per-domain documents plus `default.json` catalog |
| `config/dr/` | disaster recovery defaults | canonical defaults only |
| `config/environments/` | environment identity, image repository, deployment profile | `default.json` + per-environment overlay |
| `config/exception-recovery/` | recovery policy defaults | canonical defaults only |
| `config/gateways/` | gateway runtime controls | canonical defaults only |
| `config/knowledge/` | knowledge-plane defaults | canonical defaults only |
| `config/nl-gateway/` | NL gateway policy and throttle defaults | canonical defaults only |
| `config/plugins/` | plugin execution defaults | canonical defaults only |
| `config/product/` | product-facing defaults | canonical defaults only |
| `config/providers/` | model provider defaults and bundled model metadata | `default.json` plus named model catalogs |
| `config/quality/` | audit allowlists and quality governance metadata | canonical defaults plus audit catalogs |
| `config/risk/` | risk scoring defaults and risk register | canonical defaults plus registry |
| `config/runtime/` | runtime tuning such as timeouts, retries, breakers, and rate limits | `default.json` + per-environment overlay |
| `config/security/` | approval, sandbox, auth, and worker registration policy | `default.json` + per-environment overlay |
| `config/validation/` | validation registries and policy metadata | canonical registries; mixed JSON/YAML by tool ownership |
| `config/workflows/` | shared workflow defaults | canonical defaults only |

## Naming Exceptions

- `config/conversation/templates.json` is intentionally not named `default.json` because it is a multi-template registry, not a single mergeable default layer.
- `config/providers/models.json` and `config/providers/models.bundled.json` are intentionally named artifacts: `models.json` is the operator-editable local catalog, and `models.bundled.json` is the repository-bundled snapshot used by config-center tests and packaging.
- `config/validation/mission-operating-model-metric-alert-policy.yaml` remains YAML because it is human-authored policy content reviewed alongside runbook/metric semantics; the surrounding validation registries stay JSON for machine diffability.
- JSON config files intentionally do not use generic `$schema` meta-URLs as the source of truth. This repository validates config through runtime schemas, audits, and tests rather than editor-only schema pointers.

## Layering Rules

- Only `config/environments/`, `config/runtime/`, and `config/security/` are environment overlays.
- Everything else under `config/` is a canonical concern-scoped default or registry and should not grow `dev/staging/prod` variants unless the merge contract is documented first.
- Shared environment defaults belong in `config/environments/default.json`; per-environment files should only override environment-specific fields.
- Runtime overlays inherit `configVersion` and `configSchemaVersion` from the active runtime bundle contract; overlays may repeat them to make drift reviews explicit.
- Domain configs and `divisions/` are related but not 1:1 mirrors: `config/domains/` is the broader domain baseline catalog, while `divisions/` is the active orchestration division surface.
- `config/domains/*.json` may use baseline workflow identifiers that differ from `divisions/*/workflows/*.yaml` IDs. Domain baselines describe onboarding bundles; division workflows describe executable orchestration assets.

## Authority Boundaries

- `config/quality/division-catalog.json` is the authoritative family map for active `divisions/`.
- Built-in plugin `domainIds` / `capabilityIds` are authoritative in plugin manifests and runtime plugin definitions, not in `divisions/` metadata.
- `config/security/threat-matrix.json` is the STRIDE-style control matrix.
- `config/risk/register.json` is the operational risk register.
- `divisions/*/division.yaml` `risk_profile` is domain-local execution classification.
- These three risk surfaces are intentionally related but not 1:1 mirrors, so governance reviews must treat them as different scopes rather than duplicate sources.
- `config/quality/default.json` governs runtime quality scoring thresholds; `scripts/ci/check-coverage-baseline.mjs` governs repository coverage regression. They are intentionally separate gates.

## Data And Units

- Time fields use explicit suffixes such as `Ms`, `Seconds`, or `Minutes`; if a legacy field name cannot change yet, document the unit next to the field in the owning contract.
- Storage paths use `AA_DB_PATH` for the SQLite file location. Do not invent additional root-level path env vars unless runtime code actually reads them.
- Environment/image naming must stay aligned with `package.json`, `deploy/helm/automatic-agent/Chart.yaml`, and container defaults.

## Runtime Semantics

- `apiDefaultTimeoutMs` must stay below `apiMaxTimeoutMs`; this is enforced by config shape tests and governance validation.
- `shutdownGracePeriodMs` is milliseconds and is not mixed with second-based units.
- `configDriftReconciler.interval` is a legacy millisecond field; the unit is `ms` even though the nested key does not carry the suffix.
- Runtime rate limiting is hierarchical:
  - `requestsPerMinute` is the global ceiling.
  - `perTenantRequestsPerMinute` constrains each tenant beneath the global ceiling.
  - `perPrincipalRequestsPerMinute` constrains each principal beneath the tenant ceiling.
- Runtime circuit-breaker reset and half-open semantics live in the owning execution/runtime services; the config layer only carries enablement and thresholds that those services consume.

## Validation

- Production secrets must come from the secret manager or deployment environment.
- New security fields must be represented across all relevant `config/security/*.json` files.
- New runtime fields must have default, test, staging/pre-prod, and prod behavior reviewed.
- Environment differences and merge precedence must be documented in:
  `docs_zh/reference/environment-configuration.md`
  `docs_en/reference/environment-configuration.md`
- Prefer targeted audits and focused config tests:
  - `npm run audit:test-exclusions`
  - `npm run audit:division-workflows`
  - `tests/unit/platform/control-plane/config-center/default-config-shape.test.ts`

Do not rely on a full test run as the only proof for config correctness.
