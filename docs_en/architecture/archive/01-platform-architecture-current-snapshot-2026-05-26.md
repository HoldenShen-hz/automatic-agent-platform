# Platform Architecture Current Snapshot

> **Snapshot Date**: 2026-05-26
> **Snapshot Nature**: Latest Archive Snapshot
> **Corresponds to Current Formal Directory**: `docs_en/architecture/`
> **Purpose**: Preserves a stable archive of "current architecture entry + current implementation status" for subsequent reviews, audits, migrations, and major version refactoring

---

## 1. Current Authoritative Entry

The current platform no longer maintains a single large architecture document. Instead, it uses an "overall index + topic-specific documents" structure:

1. [../00-platform-architecture.md](../00-platform-architecture.md)
   Top-level index and reading entry.
2. [../01-code-structure.md](../01-code-structure.md)
   Code directory, module boundaries, and main layer structure.
3. [../03-module-diagrams.md](../03-module-diagrams.md)
   Module structure diagrams, relationship diagrams, and layered diagrams.
4. [../04-runtime-sequence.md](../04-runtime-sequence.md)
   Key runtime sequences and main chains.
5. [../05-cross-platform-ui-architecture.md](../05-cross-platform-ui-architecture.md)
   Cross-platform UI architecture and six-platform shell.

---

## 2. Current Architecture Statement

### 2.1 Upper-Level Design Source

- The current sole upper-level design entry is `docs_en/architecture/00-platform-architecture.md`.
- Detailed structures are no longer piled into one monolith document but split into topic-specific documents.
- Historical large documents are retained only as archives and no longer directly drive new implementations.

### 2.2 Platform Main Skeleton

- The backend still uses the P1-P5 + X1 five-plane plus cross-cutting governance skeleton:
  - `P1` Interface Plane
  - `P2` Control Plane
  - `P3` Orchestration Plane
  - `P4` Execution Plane
  - `P5` State & Evidence Plane
  - `X1` Cross-cutting governance/stability/observability capabilities
- Runtime authoritative objects continue to use `HarnessRun / NodeRun / SideEffect / Event / Budget / Mission` as the main axis.
- UI side is split according to `ui/` Monorepo, shared core, feature packages, six-platform shell.

### 2.3 Key Statements That Have Clearly Converged in Current Implementation

1. UI public query layer no longer uses `/admin/*` as the default public contract. Layer C public entry points have been added:
   - `/v1/workers`
   - `/v1/queues`
   - `/v1/agents`
   - `/v1/dashboard/metrics`
   - `/v1/explanations`
   - `/v1/meta/contract-version`
2. Frontend endpoint catalog has been unified to `/v1/*`, concatenated with runtime `baseUrl=/api` to become `/api/v1/*`.
3. `FederationAudit` and `TrustRelationship` have converged from pure in-memory specification promises to persistent implementations.
4. The async failure swallowing issue in `DurableEventBusAsync` has been fixed. Tier-1 failures return to the main chain for processing.
5. Electron bridge has unified compatibility for both `AA_ELECTRON` and `__AA_ELECTRON__`.

---

## 3. Current Formal Documents and Implementation Mapping

| Topic | Formal Document | Current Implementation Main Path |
|---|---|---|
| Top-level architecture index | [../00-platform-architecture.md](../00-platform-architecture.md) | `src/`, `ui/`, `docs_en/reviews/` |
| Code structure and module boundaries | [../01-code-structure.md](../01-code-structure.md) | `src/platform/`, `src/domains/`, `src/interaction/`, `src/scale-ecosystem/`, `src/ops-maturity/` |
| Module relationship diagrams | [../03-module-diagrams.md](../03-module-diagrams.md) | `src/platform/**`, `ui/packages/**` |
| Runtime sequences | [../04-runtime-sequence.md](../04-runtime-sequence.md) | `src/platform/five-plane-orchestration/`, `src/platform/five-plane-execution/`, `src/platform/five-plane-state-evidence/` |
| Cross-platform UI | [../05-cross-platform-ui-architecture.md](../05-cross-platform-ui-architecture.md) | `ui/apps/`, `ui/packages/shared/`, `ui/packages/features/` |

---

## 4. Differences from the 2026-05-14 Monolith Archive

| Dimension | 2026-05-14 Monolith Version | 2026-05-26 Current Snapshot |
|---|---|---|
| Document organization | One large monolith document bearing all narrative | Entry index + topic documents + review evidence write-back |
| Frontend/backend contract description | More specification goals and target API tables | More emphasis on "current real routes, OpenAPI, endpoint catalog, test evidence" consistency |
| Audit and governance | Many capabilities expressed as design commitments | Multiple capabilities have been supplemented with real implementations and targeted tests |
| UI structure | Mostly planning | `ui/` Monorepo and multi-platform shell layers have been committed to the codebase |
| Review closure approach | Chapter goals and roadmap primarily | Review documents, issue ledgers, tests, and implementation evidence closed-loop |

---

## 5. Current Status Evidence Entry

1. System-level issues and fix write-backs:
   [../../reviews/system-review-2026-05-26.md](../../reviews/system-review-2026-05-26.md)
2. Current architecture directory description:
   [../README.md](../README.md)
3. Current implementation consistency and issue ledger:
   `docs_en/reviews/`
4. Current OpenAPI and HTTP export surface:
   - `src/platform/five-plane-interface/api/openapi-document.ts`
   - `src/platform/five-plane-interface/api/http-server/`

---

## 6. Archive Maintenance Rules

1. Whenever a significant change occurs in the top-level architecture entry form, `archive/` should append a new snapshot rather than overwrite old files.
2. New snapshots must describe "current formal document entry + current implementation status + key differences from the previous snapshot".
3. Old snapshots continue to be retained and are not deleted due to changes in current implementation.