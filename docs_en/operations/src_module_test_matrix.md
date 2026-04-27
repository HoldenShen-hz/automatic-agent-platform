# Src Module Test Matrix

> Update date: 2026-04-20
> This file consolidates the maintenance matrix for the current repository structure. The authoritative source is the actual `src/` and `tests/` directories. Old `src/core/` / `src/gateway/` path lists are no longer maintained.

## 1. Counting Criteria

- Source file count: `find src/<area> -type f -name '*.ts'`
- Unit test count: `find tests/unit -type f -name '*.test.ts' | grep '/<area>/'`
- Integration test count: `find tests/integration -type f -name '*.test.ts' | grep '/<area>/'`
- `tests/golden/` and `tests/e2e/` are currently not the primary coverage source for each capability domain, so they are not listed separately in the matrix conclusions.

## 2. Current Matrix

| Capability Domain | Source Files | unit | integration | Conclusion |
| --- | ---: | ---: | ---: | --- |
| `src/platform/` | 807 | 572 | 220 | Platform core has the most complete coverage, suitable as contract/integration source of truth |
| `src/domains/` | 35 | 27 | 6 | Primarily orchestration / registry / governance units |
| `src/interaction/` | 37 | 21 | 2 | Interaction layer has main service unit tests, cross-layer flows continue to be reinforced by integration |
| `src/org-governance/` | 33 | 13 | 2 | Identity and governance services have established basic coverage, SSO/SCIM needs to maintain rejection path regression |
| `src/scale-ecosystem/` | 62 | 45 | 7 | Marketplace, cross-region, scheduling, connectors have a regression baseline |
| `src/ops-maturity/` | 81 | 32 | 12 | Observability, debugging, capacity, drift capabilities covered by unit+integration combination |
| `src/sdk/` | 93 | 12 | 35 | SDK/CLI is primarily command-level integration, unit only covers stable types and common helpers |
| `src/core/` | 8 | 1 | 0 | Compatibility layer, only minimal regression retained; new capabilities must not continue to deposit here |
| `src/plugins/` | 20 | 18 | 0 | Primarily SPI / runtime host units |
| `src/apps/` | 4 | 4 | 0 | Application entry points protected by lightweight unit tests for exports and assembly |
| `src/testing/` | 1 | 0 | 0 | Test support module, not separately requiring mirror tests |
| `src/benchmarks/` | 1 | 0 | 0 | Performance auxiliary entry, not included in regular functional regression |

## 3. Maintenance Rules

- New modules prioritize adding `tests/unit/<area>/...` in the same-level directory, cross-layer flows supplement to `tests/integration/`.
- `src/core/` only allows compatibility shims; if new implementation falls into `src/core/`, it is considered a structural regression.
- SDK changes for CLI, pack, plugin, client must include at least one command-level or surface-level test.
- When directory structure changes, only update this summary matrix, do not rewrite old file-by-file lists.

## 4. Recommended Entry Points

- For overall test requirements: [`../quality/00-full-coverage-test-manual.md`](../quality/00-full-coverage-test-manual.md)
- For pre-release gates: [`operations-checklist.md`](./operations-checklist.md)
- For architecture and implementation coverage: [`../analysis/00-architecture-coverage-matrix.md`](../analysis/00-architecture-coverage-matrix.md)
