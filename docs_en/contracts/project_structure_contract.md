# Project Structure Contract

---

## OAPEFLIR Association

This contract participates in the following OAPEFLIR eight-stage loop stages:

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

This contract defines the current repository's top-level directories, source code layering, configuration layering, and division directory conventions.

## 2. Top-Level Directories

Current authoritative top-level directories:

- `docs_zh/` / `docs_en/`: Documentation system and specifications
- `src/`: Platform source code
- `config/`: Runtime and platform-level configuration
- `divisions/`: Division definitions and role materials
- `tests/`: Test code and fixtures
- `scripts/`: Development, migration, and ops helper scripts
- `data/`: Local development period SQLite, artifact, and temporary persistence directory

Prohibited items:

- Do not mix `.venv`, `node_modules`, cache, and run artifacts under `src/`.
- Do not scatter platform-level YAML/JSON config into `src/`.
- Do not write division prompts directly into runtime code.

## 3. `src/` Authoritative Structure

Current implementation structure:

```text
src/
  core/                          # Compatibility runtime (only retains old code migration path)
    runtime/
  platform/                      # Authoritative platform core code
    control-plane/               # IAM, config center, approval center, incident control
    execution/                   # Scheduler, execution engine, recovery, worker pool
    orchestration/               # OAPEFLIR, routing, planner, HITL
    state-evidence/              # Truth, Events, Checkpoints, Artifacts, Knowledge, Memory
    interface/                   # API, channel gateway, ingress, scheduler
    shared/                      # Observability, stability, cache, common infrastructure
    model-gateway/               # Model gateway, cost tracking
    prompt-engine/               # Prompt rendering, version, evaluation, release
    compliance/                   # Compliance case orchestration and data governance
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

- `src/platform/` is the authoritative code directory and contains all core runtime logic
- `src/core/` is only for backward compatibility and does not add new canonical runtime logic
- Inside `src/platform/` is organized by five-plane architecture: control-plane, execution, orchestration, state-evidence, interface
- Upper-layer business capabilities are in corresponding upper directories (interaction, org-governance, ops-maturity, etc.)

Notes:

- `src/platform/` is the authoritative platform core directory.
- `src/core/` only retains compatibility and migration closure and does not add new canonical platform capabilities.
- `src/domains/`, `src/interaction/`, `src/org-governance/`, `src/scale-ecosystem/`, `src/ops-maturity/` are architecture v2.7 upper-layer capability domains.
- If future need arises to introduce new top-level domain directory, this contract must be updated first, then migration performed.

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
- `environments/`: Environment-level switches and promote thresholds.
- `exception-recovery/`: Panic / resume / replay / repair related policies.
- `runtime/`: Concurrency, timeout, retry, queue, and other runtime parameters.
- `security/`: Permissions, approval thresholds, dangerous operation policies.
- `providers/`: LLM provider, model routing, and fallback strategies.
- `gateways/`: CLI/Web/Telegram and other channel configurations.
- `knowledge/`: Knowledge / semantic backend / retention configuration.
- `nl-gateway/`: Natural language entry, ambiguity clarification, and decomposition gates.
- `plugins/`: Plugin, pack, and connector default configuration.
- `product/`: Billing, marketplace, and tenant product surface configuration.
- `quality/`: Eval, quality gates, and regression baselines.
- `risk/`: Risk assessment and deny/approve configuration.
- `workflows/`: HQ-level shared workflow templates.

Supplementary notes:

- Four-layer configuration priority, prompt / config / policy / flag decoupling, and default registry are authoritative in the drill-down document `configuration_layers_and_defaults_contract.md`.

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
- `roles/` only stores role prompts and role descriptions and does not store runtime state.
- `workflows/` only stores declarative process definitions.
- `schemas/` stores structural constraints for division input/output, artifacts, or forms.

## 6. `data/` Structure Constraints

Local development environment may adopt:

```text
data/
  sqlite/
  artifacts/
  logs/
```

Rules:

- SQLite files, artifacts, and logs are physically isolated.
- `data/` is only for local or single-machine development environment and is not a long-term production design fact source.

## 7. Ownership And Change Constraints

- Directory structure changes should first modify this contract, then modify `docs_zh/architecture/00-04`, `operations/`, and corresponding implementations.
- If `apps/` multi-process structure needs to be introduced, add new ADR and update this contract.
- Current stage does not introduce premature microservice splitting.

## 8. Supplementary Rules

- Route modules under `src/platform/five-plane-interface/api/http-server/` should be named by resource, e.g., `task-routes.ts`, `approval-routes.ts`, `health-routes.ts`, and avoid splitting by HTTP verbs.
- `tests/` is at minimum divided into `unit/`, `integration/`, `e2e/` three layers, with fixtures and replay resources separately in shared directories.
- Production environment does not depend on local `data/` and should be replaced by database, object storage, and centralized log/audit backend.