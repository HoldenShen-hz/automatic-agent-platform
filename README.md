# Automatic Agent Platform

Enterprise automatic-agent platform baseline built on Node.js 20/22 + TypeScript ESM. The repository now follows the v2.7 seven-layer architecture defined in `docs_zh/architecture/00-platform-architecture.md`, with ADR, contract, source, and test coverage tracked in `docs_zh/analysis/00-architecture-coverage-matrix.md`.

## Quick Start

```bash
npm ci
npm run build
npm test
```

Common local commands:

```bash
npm run doctor
npm run inspect
npm run dispatch-execution
npm run worker-handshake
npm run worker-writeback
npm run migrate:status
aa doctor
aa platform-operator
```

Validation and release helpers:

```bash
npm run lint
npm run typecheck
npm run coverage:gate
npm run changelog:check
npm run test:pg-integration
npm run test:secret-providers
npm run package:stable
```

Stable script overview:

- `npm run package:stable` — package assembly and release artifact checks
- `npm run validate:stable` — contract/config/runtime validation gate
- `npm run migration:stable` — migration and persistence readiness gate
- `npm run chaos:stable` — controlled chaos/recovery drill entry
- `npm run concurrency:stable` — concurrency and queue pressure validation
- `npm run db-queue-disconnect:stable` — DB/queue disconnect recovery validation

## Documentation

- `docs_zh/architecture/00-platform-architecture.md` — v2.7 architecture source
- `docs_zh/architecture/01-code-structure.md` — code structure design
- `docs_zh/migration/README.md` — migration rules and E2E workflow migration index
- `docs_zh/adr/` — architectural decisions
- `docs_zh/contracts/` — authoritative contracts
- `docs_zh/reference/docs-sync.md` — zh/en sync rules and delayed-translation policy
- `translate_docs.py` — legacy translation helper with maintenance notes in its module docstring
- `docs_zh/analysis/00-architecture-coverage-matrix.md` — chapter-to-code coverage matrix
- `docs_zh/analysis/01-codebase-vs-design-review.md` — current codebase review

## Project Structure

```text
src/
  apps/             # app entrypoints and launch surfaces
  benchmarks/       # performance and benchmark helpers
  platform/         # five planes plus shared contracts / gateway / prompt / stability modules
    five-plane-interface/
    five-plane-control-plane/
    five-plane-orchestration/
    five-plane-execution/
    five-plane-state-evidence/
  domains/          # domain descriptor, onboarding, prompt/eval/domain registry
  interaction/      # NL entry, goal decomposition, proactive agent, dashboard, UX
  org-governance/   # org model, approval routing, SSO/SCIM, compliance, knowledge boundary
  scale-ecosystem/  # multi-region, resource manager, SLA, marketplace, feedback, connectors
  ops-maturity/     # explainability, panic/resume, edge runtime, drift, cost, debugger, multimodal
  sdk/              # CLI and SDK-facing entry surfaces
  plugins/          # built-in plugin/runtime extension points
  testing/          # test-support utilities shipped with source
tests/
  unit/ integration/ golden/ e2e/
```

## Current Notes

- `src/core/runtime/` is retained only as a compatibility shim layer; canonical orchestration/runtime code lives under `src/platform/five-plane-execution/` and `src/platform/five-plane-orchestration/`.
- Root docs, ADR, contracts, and review matrices are expected to stay consistent. If a boundary changes, update the matching contract and tests in the same change.

## License

MIT
