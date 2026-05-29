# Platform Architecture - Authoritative Entry Point

> **Review Date**: 2026-05-27
> **Note**: This file is the "Architecture Entry Index", not a placeholder stub for falling back to a monolithic document.

## 1. Current Authority Matrix

| Issue to Confirm | Authoritative Entry |
| --- | --- |
| Platform overview, reading order | [README.md](./README.md) |
| Module structure vs. plane boundaries | [01-code-structure.md](./01-code-structure.md), [03-module-diagrams.md](./03-module-diagrams.md) |
| Runtime sequences | [04-runtime-sequence.md](./04-runtime-sequence.md) |
| UI / multi-endpoint boundaries | [05-cross-platform-ui-architecture.md](./05-cross-platform-ui-architecture.md) |
| Specification objects vs. protocol boundaries | [../contracts/README.md](../contracts/README.md) |
| History vs. decision evolution | [../adr/README.md](../adr/README.md) |
| Current gaps vs. remediation status | [../reviews/platforme-full-review-b.md](../reviews/platforme-full-review-b.md) |

## 2. Current Engineering Naming Baseline

- Platform core: `five-plane-interface`, `five-plane-control-plane`, `five-plane-orchestration`, `five-plane-execution`, `five-plane-state-evidence`
- Cross-cutting capabilities: `shared`, `contracts`, `model-gateway`, `prompt-engine`, `compliance`
- Upper-layer capabilities: `domains`, `interaction`, `org-governance`, `scale-ecosystem`, `ops-maturity`

## 3. Usage Rules

- When you need "the big picture", first read this entry point, then jump to topic-specific documents. Do not treat a single file as the complete source of truth.
- Current implementation closure must return to the review table or contract/ADR; do not repeat line-level issues on this entry page.
- Historical monolithic architecture documents are retained only in archive, for traceability, and not as the current authoritative entry.