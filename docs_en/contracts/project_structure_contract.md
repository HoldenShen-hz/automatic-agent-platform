# Project Structure Contract

## 1. Scope

This contract defines top-level directory, source code layering, configuration layering, and division directory conventions when entering Phase 1a implementation.

## 2. Top-Level Directory

Phase 1a allows and recommends the following top-level directories:

- `doc/`: Documentation system and specifications
- `src/`: Platform source code
- `config/`: Runtime and platform-level configuration
- `divisions/`: Division definitions and role materials
- `tests/`: Test code and fixtures
- `scripts/`: Development, migration, operations helper scripts
- `data/`: Local development period SQLite, artifact, temporary persistence directory

Prohibited items:

- Do not mix `.venv`, `node_modules`, cache, and run products under `src/`.
- Do not scatter platform-level YAML/JSON configuration into `src/`.
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
    cost/
    queue/
  gateway/
    stream/
    targets/
  cli/
```

Rules:

- `core/` only places platform core domain models and running logic.
- `gateway/` is responsible for channel adapter and does not own task orchestration semantics.
- API, tools, providers, division loader in current implementation are uniformly converged under `src/core/` rather than split into `src/server/` / `src/tools/` / `src/providers/` top-level directories.
- `src/core/divisions/` is only responsible for loading definitions and does not carry division business content itself.

Reservable but not Phase 1a required directories:

```text
src/
  core/
    memory/
  perception/
  supervisor/
```

Explanation:

- `memory/`, `perception/`, `supervisor/` can be reserved as subsequent phase directories but should not be mistaken as Phase 1a current required deliverables.
- If future need to further split `api` / `tools` / `providers` from `src/core/` to top-level directories, must first update this contract then migrate.

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
- `runtime/`: Concurrency, timeout, retry, queue and other runtime parameters.
- `security/`: Permissions, approval thresholds, dangerous operation policies.
- `providers/`: LLM provider, model routing, fallback strategies.
- `gateways/`: CLI/Web/Telegram and other channel configurations.
- `workflows/`: HQ-level shared workflow templates.

Supplementary explanation:

- Configuration four-layer priority, prompt / config / policy / flag decoupling, default value registry detailed in `configuration_layers_and_defaults_contract.md`.

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

- Each division must have unique `division.yaml` as entry.
- `roles/` only saves role prompts and role descriptions and does not save runtime state.
- `workflows/` only saves declarative process definitions.
- `schemas/` saves input-output, artifact, or form structural constraints for that division.

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
- `data/` is only used for local or single-machine development environment and not as long-term production design fact source.

## 7. Ownership and Change Constraints

- Directory structure changes should first modify this contract, then modify `01` ~ `07`, `operations/` and corresponding implementation.
- If need to introduce `apps/` multi-process structure, should add ADR and update this contract.
- Phase 1a does not introduce premature microservices splitting.

## 8. Supplementary Rules

- `server/api` directory named by resource, such as `tasks/`, `approvals/`, `health/`, avoid splitting by HTTP verbs.
- `tests/` minimum divided into `unit/`, `integration/`, `e2e/` three layers, fixtures and replay resources separately placed in shared directory.
- Production environment does not depend on local `data/` and should be replaced by database, object storage, and centralized log/audit backend.
