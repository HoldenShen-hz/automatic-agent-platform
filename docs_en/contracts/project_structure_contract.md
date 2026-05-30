# Project Structure Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cycle:

- **Observe**: Signal collection and aggregation
- **Assess**: Pre-execution assessment and risk judgment
- **Plan**: Task decomposition and DAG construction
- **Execute**: Step execution and fault tolerance
- **Feedback**: Signal collection and preprocessing
- **Learn**: Pattern detection and knowledge extraction
- **Improve**: Improvement candidate evaluation and rollout
- **Release**: Controlled release and rollback

---

## 1. Scope

This contract defines the top-level directory, source code layers, configuration layers, and business division directory conventions for the current repository.

## 2. Top-Level Directory

Current authoritative top-level directories:

- `docs_zh/` / `docs_en/`: Documentation system and standards
- `src/`: Platform source code
- `config/`: Runtime and platform-level configuration
- `divisions/`: Business division definitions and role materials
- `tests/`: Test code and fixtures
- `scripts/`: Development, migration, and operations auxiliary scripts
- `data/`: Local development period SQLite, artifacts, temporary persistence directory

Prohibited items:

- Must not mix `.venv`, `node_modules`, cache, and runtime artifacts under `src/`.
- Must not scatter platform-level YAML/JSON configuration inside `src/`.
- Must not hardcode business division prompts directly in runtime code.

## 3. `src/` Authoritative Structure

Current implementation structure:

```text
src/
  core/                          # Compatibility runtime (only preserves old code migration paths)
    runtime/
  platform/                      # Authoritative platform core code
    control-plane/               # IAM, config center, approval center, event control
    execution/                   # Scheduler, execution engine, recovery, worker pool
    orchestration/               # OAPEFLIR, routing, planner, HITL
    state-evidence/              # Truth, events, checkpoints, artifacts, knowledge, memory
    interface/                   # API, channel gateway, ingress, scheduler
    shared/                      # Observability, stability, cache, common infrastructure
    model-gateway/               # Model gateway, cost tracking
    prompt-engine/               # Prompt rendering, versioning, evaluation, release
    compliance/                  # Compliance case orchestration and data governance
    agent-delegation/            # Agent delegation
    cost-management/             # Cost management
    prompt-registry/             # Prompt registry
  interaction/                   # NL entry, goal decomposition, proactive agent, dashboard, UX
  org-governance/                # Organization hierarchy, SSO/SCIM, compliance
  ops-maturity/                  # Explainability, drift detection, edge computing, cost, chaos engineering
  scale-ecosystem/               # Multi-region, fair scheduling, SLA, connectors, marketplace
  sdk/                           # CLI, pack SDK, plugin SDK, client SDK
  domains/                       # Domain descriptors, onboarding, registry
  plugins/                       # Plugin system
  testing/                       # Testing utilities
  benchmarks/                    # Performance benchmarks
  apps/                         # Application entry points
```

Rules:

- `src/platform/` is the authoritative code directory containing all core runtime logic
- `src/core/` is only for backward compatibility; do not add new canonical runtime logic here
- Inside `src/platform/`, organization follows five-plane architecture: control-plane, execution, orchestration, state-evidence, interface
- Upper-layer business capabilities are in corresponding upper directories (interaction, org-governance, ops-maturity, etc.)

Notes:

- `src/platform/` is the authoritative platform core directory.
- `src/core/` only preserves compatibility and migration interfaces; do not add new canonical platform capabilities.
- `src/domains/`, `src/interaction/`, `src/org-governance/`, `src/scale-ecosystem/`, `src/ops-maturity/` are architecture v2.7 upper-layer capability domains.
- If a new top-level domain directory needs to be introduced in the future, must first update this contract, then proceed with migration.

## 4. `config/` Authoritative Structure

```text
config/
  bootstrap/
  conversation/
  cost-alert/
  domains/
  dr/
  environments/
  exception-recovery/
  gateways/
  knowledge/
  nl-gateway/
  plugins/
  product/
  providers/
  quality/
  risk/
  runtime/
  security/
  workflows/
```

Meanings:

- `bootstrap/`: Base configuration that must be loaded at platform startup.
- `conversation/`: Conversation templates, threads, and UX-related configuration.
- `cost-alert/`: Cost thresholds and alerting strategies.
- `domains/`: Domain descriptors, onboarding, and default governance configuration.
- `dr/`: Cross-region / fault recovery parameters.
- `environments/`: Environment-level switches and promotion thresholds.
- `exception-recovery/`: panic / resume / replay / repair related strategies.
- `runtime/`: Concurrency, timeout, retry, queue, and other runtime parameters.
- `security/`: Permissions, approval thresholds, dangerous operation policies.
- `providers/`: LLM provider, model routing, fallback strategies.
- `gateways/`: CLI/Web/Telegram and other channel configurations.
- `knowledge/`: knowledge / semantic backend / retention configuration.
- `nl-gateway/`: Natural language entry, disambiguation, and decomposition gates.
- `plugins/`: Plugin, pack, connector default configurations.
- `product/`: Billing, marketplace, tenant product surface configuration.
- `quality/`: eval, quality gate, and regression baselines.
- `risk/`: Risk assessment and deny/approve configuration.
- `workflows/`: HQ-level shared workflow templates.

Supplementary notes:

- Configuration four-layer priority, prompt / config / policy / flag decoupling, and default value registry are based on the drilling document `configuration_layers_and_defaults_contract.md`.

## 5. `divisions/` Authoritative Structure

```text
divisions/
  <division-id>/
    division.yaml
    roles/
      <role-id>.prompt.md
    workflows/
      *.yaml
    schemas/
      *.json
```

Rules:

- Each business division must have a unique `division.yaml` as the entry point.
- `roles/` only stores role prompts and role descriptions, not runtime state.
- `workflows/` only stores declarative process definitions.
- `schemas/` stores structural constraints for that division's input/output, artifacts, or forms.

## 6. `data/` Structure Constraints

Local development environment may use:

```text
data/
  sqlite/
  artifacts/
  logs/
```

Rules:

- SQLite files, artifacts, and logs are physically isolated.
- `data/` is only for local or single-machine development environments and is not designed as a long-term production source of truth.

## 7. Ownership and Change Constraints

- Directory structure changes should first modify this contract, then modify `docs_zh/architecture/00-04`, `operations/`, and corresponding implementations.
- If `apps/` multi-process structure needs to be introduced, should add an ADR and update this contract.
- Current stage does not introduce premature microservice splitting.

## 8. Supplementary Rules

- Route modules under `src/platform/five-plane-interface/api/http-server/` should be named by resource, such as `task-routes.ts`, `approval-routes.ts`, `health-routes.ts`, avoiding splitting by HTTP verbs.
- `tests/` should be divided into at least three layers: `unit/`, `integration/`, `e2e/`, with fixtures and replay resources placed separately in a shared directory.
- Production environment does not depend on local `data/`; should be replaced with database, object storage, and centralized logging/audit backend.