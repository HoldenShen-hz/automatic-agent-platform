# Project Structure Contract

---

## OAPEFLIR Related

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

This contract defines the current repository's top-level directories, source code tiering, configuration tiering, and division directory conventions.

## 2. Top-Level Directories

Current authoritative top-level directories:

- `docs_zh/` / `docs_en/`: Documentation system and specifications
- `src/`: Platform source code
- `config/`: Runtime and platform-level configuration
- `divisions/`: Division definitions and role materials
- `tests/`: Test code and fixtures
- `scripts/`: Development, migration, and operations auxiliary scripts
- `data/`: Local development SQLite, artifact, and temporary persistence directory

Prohibited:

- Do not mix `.venv`, `node_modules`, cache, and runtime artifacts into `src/`.
- Do not scatter platform-level YAML/JSON configuration inside `src/`.
- Do not write division prompts directly into runtime code.

## 3. `src/` Authoritative Structure

Current implementation structure:

```text
src/
  core/                          # Compatibility runtime (only preserves old code migration path)
    runtime/
  platform/                      # Authoritative platform core code
    control-plane/               # IAM, config center, approval center, incident control
    execution/                   # Scheduler, execution engine, recovery, worker pool
    orchestration/               # OAPEFLIR, routing, planner, HITL
    state-evidence/              # Truth, Events, Checkpoints, Artifacts, Knowledge, Memory
    interface/                   # API, Channel Gateway, Ingress, Scheduler
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
  sdk/                           # CLI, Pack SDK, Plugin SDK, Client SDK
  domains/                       # Domain descriptors, onboarding, registry
  plugins/                       # Plugin system
  testing/                       # Testing tools
  benchmarks/                    # Performance benchmarks
  apps/                         # Application entry points
```

Rules:

- `src/platform/` is the authoritative code directory, containing all core runtime logic
- `src/core/` is only for backward compatibility, does not add new canonical runtime logic
- `src/platform/` internal organization follows five-plane architecture: control-plane, execution, orchestration, state-evidence, interface
- Upper-layer business capabilities reside in corresponding upper directories (interaction, org-governance, ops-maturity, etc.)

Notes:

- `src/platform/` is the authoritative platform core directory.
- `src/core/` only preserves compatibility and migration closure, does not add new canonical platform capabilities.
- `src/domains/`, `src/interaction/`, `src/org-governance/`, `src/scale-ecosystem/`, `src/ops-maturity/` are architecture v2.7 upper-layer capability domains.
- If future need arises to introduce new top-level domain directory, must first update this contract, then proceed with migration.

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

Meaning:

- `bootstrap/`: Base configuration that must be loaded at platform startup.
- `conversation/`: Conversation templates, threads, and UX-related configuration.
- `cost-alert/`: Cost thresholds and alert strategies.
- `domains/`: Domain descriptors, onboarding, and default governance configuration.
- `dr/`: Cross-region / disaster recovery parameters.
- `environments/`: Environment-level switches and promote thresholds.
- `exception-recovery/`: Panic / resume / replay / repair related policies.
- `runtime/`: Concurrency, timeout, retry, queue, and other runtime parameters.
- `security/`: Permissions, approval thresholds, dangerous operation policies.
- `providers/`: LLM provider, model routing, and degradation strategies.
- `gateways/`: CLI/Web/Telegram and other channel configurations.
- `knowledge/`: Knowledge / semantic backend / retention configuration.
- `nl-gateway/`: Natural language entry, ambiguity clarification, and decomposition gates.
- `plugins/`: Plugin, pack, connector default configuration.
- `product/`: Billing, marketplace, tenant product surface configuration.
- `quality/`: Eval, quality gate, and regression baseline.
- `risk/`: Risk assessment and deny/approve configuration.
- `workflows/`: HQ-level shared workflow templates.

Supplementary notes:

- Configuration four-layer priority, prompt / config / policy / flag decoupling, and default value registry are governed by drill-down document `configuration_layers_and_defaults_contract.md`.

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

- Each division must have a unique `division.yaml` as entry point.
- `roles/` only saves role prompts and role descriptions; does not save runtime state.
- `workflows/` only saves declarative process definitions.
- `schemas/` saves structural constraints for division input/output, artifacts, or forms.

## 6. `data/` Structure Constraints

Local development environment can use:

```text
data/
  sqlite/
  artifacts/
  logs/
```

Rules:

- SQLite files, artifacts, and logs are physically isolated.
- `data/` is only used for local or single-machine development environments; not used as long-term production design source of truth.

## 7. Ownership and Change Constraints

- Directory structure changes should first modify this contract, then modify `docs_zh/architecture/00-04`, `operations/` and corresponding implementations.
- If need arises to introduce `apps/` multi-process structure, add new ADR and update this contract.
- Current phase does not introduce premature microservices splitting.

## 8. Supplementary Rules

- Route modules under `src/platform/interface/api/http-server/` should be named by resource, such as `task-routes.ts`, `approval-routes.ts`, `health-routes.ts`; avoid splitting by HTTP verbs.
- `tests/` at minimum is divided into `unit/`, `integration/`, `e2e/` three layers; fixtures and replay resources are separately placed in shared directory.
- Production environment does not depend on local `data/`; should be replaced with database, object storage, and centralized logging/audit backend.