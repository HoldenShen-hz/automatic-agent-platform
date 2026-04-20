# Project Structure Contract

---

## OAPEFLIR Association

This contract participates in the following stages of the OAPEFLIR eight-stage cognitive loop:

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

This contract defines top-level directories, source code tiering, configuration tiering, and division directory conventions when entering Phase 1a-4 implementation.

## 2. Top-Level Directories

Phase 1a allows and recommends the following top-level directories:

- `doc/`: Documentation system and specifications
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

Phase 1a recommended structure:

```text
src/
  core/
    api/
    artifacts/
    config/
    divisions/
    events/
    memory/
    observability/
    providers/
    runtime/
    security/
    storage/
    tools/
    workflow/
    types/
    approvals/
    agent-loop/
    assessment/
    feedback/
    improvement/
    learning/
    planning/
    cost/
    queue/
  gateway/
    stream/
    targets/
  cli/
```

Rules:

- `core/` only contains platform core domain models and runtime logic.
- `gateway/` is responsible for channel adaptation; does not own task orchestration semantics.
- API, tools, providers, and division loader in current implementation are uniformly converged under `src/core/`, not split into top-level directories like `src/server/` / `src/tools/` / `src/providers/`.
- `src/core/divisions/` is only responsible for loading definitions; does not carry division business content itself.

Can be reserved but not Phase 1a required:

```text
src/
  core/
    memory/
  supervisor/
  plugins/
  domains/
```

Notes:

- `memory/`, `supervisor/`, `plugins/`, `domains/` can be reserved for future phases but should not be mistaken as Phase 1a current required deliverables.
- Current Observe semantics prioritize convergence in `src/core/observability/`, `src/core/agent-loop/`, and `src/core/assessment/`, not new top-level `perception/` directory.
- If future need arises to further split `api` / `tools` / `providers` from `src/core/` to top-level directories, this contract must be updated first, then migration proceeds.

## 4. `config/` Authoritative Structure

```text
config/
  bootstrap/
  runtime/
  security/
  providers/
  gateways/
  workflows/
```

Meaning:

- `bootstrap/`: Base configuration that must be loaded at platform startup.
- `runtime/`: Concurrency, timeout, retry, queue, and other runtime parameters.
- `security/`: Permissions, approval thresholds, dangerous operation policies.
- `providers/`: LLM provider, model routing, and degradation strategies.
- `gateways/`: CLI/Web/Telegram and other channel configurations.
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

Phase 1a local development can use:

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

- Directory structure changes should first modify this contract, then modify `01` ~ `07`, `operations/` and corresponding implementations.
- If need arises to introduce `apps/` multi-process structure, add new ADR and update this contract.
- Phase 1a does not introduce premature microservices splitting.

## 8. Supplementary Rules

- `server/api` directory is named by resource, such as `tasks/`, `approvals/`, `health/`; avoid splitting by HTTP verbs.
- `tests/` is divided into at least `unit/`, `integration/`, `e2e/` three layers; fixtures and replay resources are separately placed in shared directory.
- Production environment does not depend on local `data/`; should be replaced with database, object storage, and centralized logging/audit backend.
