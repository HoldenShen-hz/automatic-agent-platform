# Automatic Agent Platform - Development Memory

This file is a lightweight engineering memory for the current repository layout.

It is not a source of truth. Use `AGENTS.md`, `CLAUDE.md`, and `docs_zh/governance/repository-guide-index.md` for authoritative repository guidance, and update this file only as a concise working-memory aid.

## Current Code Topology

- Runtime core: `src/platform/`
- Business capability layers: `src/domains/`, `src/interaction/`, `src/org-governance/`, `src/scale-ecosystem/`, `src/ops-maturity/`
- SDK and operator entrypoints: `src/sdk/`
- Built-in plugin surfaces: `src/plugins/`

## Current Architectural Notes

- Canonical multi-step orchestration lives in `src/platform/five-plane-execution/execution-engine/`.
- `src/core/runtime/` is retained only as a re-export compatibility surface.
- ADR and contract completeness should be checked from:
  - `docs_zh/adr/README.md`
  - `docs_zh/contracts/README.md`
  - `docs_zh/analysis/00-architecture-coverage-matrix.md`
  - `docs_zh/governance/source_of_truth.md`
  - `docs_zh/governance/naming_and_directory_conventions.md`

## Validation Shortcuts

- Full build: `npm run build`
- Full regression: `npm test`
- Docs health: `node --import tsx --test tests/unit/docs/documentation-health.test.ts`
- Contract integration: `node --import tsx --test tests/integration/platform/contracts/extension-contracts.test.ts`

## Edit Contract

- Keep this file short and observational; do not duplicate full process guidance from `README.md` or `CONTRIBUTING.md`.
- If root documentation guidance changes, update `docs_zh/governance/repository-guide-index.md` first and then adjust this memory summary.
