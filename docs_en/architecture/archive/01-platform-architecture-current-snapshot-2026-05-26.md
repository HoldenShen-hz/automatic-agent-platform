# Platform Architecture Current Snapshot

> **Snapshot Date**: 2026-05-26
> **Snapshot Nature**: Latest archived snapshot
> **Corresponding Current Official Directory**: `docs_zh/architecture/`
> **Purpose**: To retain a stable archive of "current architecture entry + current implementation state" for subsequent review, audit, migration, and major version refactoring

---

## 1. Current Authoritative Entry Points

The current platform no longer maintains a single oversized architecture document, but uses a "master index + thematic documents" structure:

1. [../00-platform-architecture.md](../00-platform-architecture.md)
   Top-level index and reading entry point.
2. [../01-code-structure.md](../01-code-structure.md)
   Code directory, module boundaries, main layer structure.
3. [../03-module-diagrams.md](../03-module-diagrams.md)
   Module structure diagrams, relationship diagrams, and layered diagrams.
4. [../04-runtime-sequence.md](../04-runtime-sequence.md)
   Key runtime sequences and main paths.
5. [../05-cross-platform-ui-architecture.md](../05-cross-platform-ui-architecture.md)
   Cross-platform UI architecture and six-platform shell.

---

## 2. Current Architecture Scope

### 2.1 Upper-Level Design Source

- The current only upper-level design entry is `docs_zh/architecture/00-platform-architecture.md`.
- Detailed structure is no longer stacked into a single monolith document, but split into thematic documents.
- Historical large documents are only retained as archives and no longer directly drive new implementation.

### 2.2 Platform Main Skeleton

- Backend still uses `P1-P5 + X1` five-plane plus cross-cutting governance skeleton:
  - `P1` Interface Plane
  - `P2` Control Plane
  - `P3` Orchestration Plane
  - `P4` Execution Plane
  - `P5` State & Evidence Plane
  - `X1` Cross-cutting governance/stability/observability capabilities
- Runtime authoritative objects continue to use `HarnessRun / NodeRun / SideEffect / Event / Budget / Mission` as the main axis.
- UI side is split by `ui/` Monorepo, shared core, feature packages, six-platform shell.

### 2.3 Key口径 That Have Clearly Converged in Current Implementation

1. UI public query layer no longer uses `/admin/*` as the default public contract; Layer C public entry points have been completed:
   - `/v1/workers`
   - `/v1/queues`
   - `/v1/agents`
   - `/v1/dashboard/metrics`
   - `/v1/explanations`
   - `/v1/meta/contract-version`
2. Frontend endpoint catalog has been unified to `/v1/*`, with runtime `baseUrl=/api` concatenated to `/api/v1/*`.
3. `FederationAudit`, `TrustRelationship` have converged from pure in-memory specification commitment to persistent implementation.
4. The async failure swallowing issue in `DurableEventBusAsync` has been fixed; Tier-1 failures return to the main chain for processing.
5. Electron bridge has been unified with compatibility for `AA_ELECTRON` and `__AA_ELECTRON__`.

---

## 3. Current Official Documents and Implementation Mapping

| Topic | Official Document | Current Implementation Main Path |
|---|---|---|
| Top-level architecture index | [../00-platform-architecture.md](../00-platform-architecture.md) | `src/`, `ui/`, `docs_zh/reviews/` |
| Code structure and module boundaries | [../01-code-structure.md](../01-code-structure.md) | `src/platform/`, `src/domains/`, `src/interaction/`, `src/scale-ecosystem/`, `src/ops-maturity/` |
| Module relationship diagrams | [../03-module-diagrams.md](../03-module-diagrams.md) | `src/platform/**`, `ui/packages/**` |
| Runtime sequences | [../04-runtime-sequence.md](../04-runtime-sequence.md) | `src/platform/five-plane-orchestration/`, `src/platform/five-plane-execution/`, `src/platform/five-plane-state-evidence/` |
| Cross-platform UI | [../05-cross-platform-ui-architecture.md](../05-cross-platform-ui-architecture.md) | `ui/apps/`, `ui/packages/shared/`, `ui/packages/features/` |

---

## 4. Differences from 2026-05-14 Monolith Archived Version

| Dimension | 2026-05-14 Monolith Version | 2026-05-26 Current Snapshot |
|---|---|---|
| Document organization | One oversized monolith document carrying all narrative | Entry index + thematic documents + review evidence written back |
| Frontend-backend contract description | More specification targets and target API tables | More emphasis on "current real routes, OpenAPI, endpoint catalog, test evidence" consistency |
| Audit and governance | Large number of capabilities expressed as design commitments | Many capabilities have been completed as real implementation with targeted tests |
| UI structure | Primarily planning | `ui/` Monorepo and multi-platform shell have been implemented |
| Review closure approach | Primarily chapter goals and roadmap | Closed loop via review documents, issue tracking, tests, and implementation evidence |

---

## 5. Current State Evidence Entry Points

1. System-level issues and fix written back:
   [../../reviews/system-review-2026-05-26.md](../../reviews/system-review-2026-05-26.md)
2. Current architecture directory guide:
   [../README.md](../README.md)
3. Current implementation consistency and issue tracking:
   `docs_zh/reviews/`
4. Current OpenAPI and HTTP export surface:
   - `src/platform/five-plane-interface/api/openapi-document.ts`
   - `src/platform/five-plane-interface/api/http-server/`

---

## 6. Archive Maintenance Rules

1. When the top-level architecture entry undergoes significant morphological changes, `archive/` should append a new snapshot rather than overwriting old files.
2. New snapshots should describe "current official document entry + current implementation state + key differences from the previous snapshot".
3. Old snapshots continue to be retained and historical content is not deleted due to current implementation changes.
