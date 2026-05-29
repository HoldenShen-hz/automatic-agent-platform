# Src Module Test Matrix

> Updated: 2026-04-20
> This file consolidates to the current repository structure maintenance matrix; source of truth is actual `src/` and `tests/` directories, no longer maintaining old `src/core/` / `src/gateway/` path lists.

## 1. Counting Scope

- Source file count: `find src/<area> -type f -name '*.ts'`
- Unit test count: `find tests/unit -type f -name '*.test.ts' | grep '/<area>/'`
- Integration test count: `find tests/integration -type f -name '*.test.ts' | grep '/<area>/'`
- `tests/golden/` and `tests/e2e/` are currently not the main coverage source for each capability domain, so not separately listed in matrix conclusions.

## 2. Current Matrix

| Capability Domain | Source Files | Unit | Integration | Conclusion |
| --- | ---: | ---: | ---: | --- |
| `src/platform/` | 807 | 572 | 220 | Platform core has most complete coverage, suitable as contract/integration source of truth |
| `src/domains/` | 35 | 27 | 6 | Mainly orchestration / registry / governance units |
| `src/interaction/` | 37 | 21 | 2 | Interaction layer has main service unit tests, cross-layer flows continue to be reinforced by integration |
| `src/org-governance/` | 33 | 13 | 2 | Identity and governance services have established basic coverage, SSO/SCIM needs to maintain rejection path regression |
| `src/scale-ecosystem/` | 62 | 45 | 7 | Marketplace, cross-region, scheduling, connectors have regressable baseline |
| `src/ops-maturity/` | 81 | 32 | 12 | Observability, debugging, capacity, drift capabilities covered by unit+integration combination |
| `src/sdk/` | 93 | 12 | 35 | SDK/CLI focuses on command-level integration; unit only covers stable types and public helpers |
| `src/core/` | 8 | 1 | 0 | Compatibility layer, only retains minimum regression; new capabilities must not continue depositing here |
| `src/plugins/` | 20 | 18 | 0 | Mainly SPI / runtime host units |
| `src/apps/` | 4 | 4 | 0 | App entry points secured by lightweight unit tests for export and assembly |
| `src/testing/` | 1 | 0 | 0 | Test support module, no separate image testing required |
| `src/benchmarks/` | 1 | 0 | 0 | Performance auxiliary entry, not included in regular functional regression |

## 3. Maintenance Rules

- New modules preferentially add to `tests/unit/<area>/...` at same level; cross-layer flows add to `tests/integration/`.
- `src/core/` only allows compatibility shims; if new implementation falls in `src/core/`, treated as structural regression.
- SDK changes for CLI, pack, plugin, client must include at least one command-level or surface-level test.
- When directory structure changes, only update this summary matrix, no longer write back old file-by-file lists.

## 4. Recommended Entry Points

- For overall testing requirements: [`../quality/00-full-coverage-test-manual.md`](../quality/00-full-coverage-test-manual.md)
- For pre-release gates: [`operations-checklist.md`](./operations-checklist.md)
- For architecture and implementation coverage: [`../analysis/00-architecture-coverage-matrix.md`](../analysis/00-architecture-coverage-matrix.md)