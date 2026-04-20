# Architecture Decision Records (ADR)

> This directory contains the project's Architecture Decision Records (ADR). Each ADR records the background, considerations, and conclusions of an important technical decision.

## ADR Index

| Number | Title | Status | Decision Date |
|--------|-------|--------|---------------|
| [001](./001-three-layer-architecture.md) | Three-Layer Distributed Architecture | Accepted | 2026-04-02 |
| [002](./002-division-system.md) | Division System | Accepted | 2026-04-02 |
| [003](./003-memory-seven-layers.md) | Six-Layer Memory and KV Cache Fixed Prefix | Accepted | 2026-04-02 |
| [004](./004-workflow-routing.md) | Workflow and Routing | Accepted | 2026-04-02 |
| [005](./005-security-model.md) | Security Model | Accepted | 2026-04-02 |
| [006](./006-llm-provider-strategy.md) | LLM Provider Strategy | Accepted | 2026-04-02 |
| [007](./007-evolution-engine.md) | Evolution Engine | Accepted | 2026-04-02 |
| [008](./008-cost-model.md) | Cost Model | Accepted | 2026-04-02 |
| [009](./009-deployment-ops.md) | Deployment and Operations | Accepted | 2026-04-02 |
| [010](./010-commercial-model.md) | Commercial Model | Accepted | 2026-04-02 |
| [011](./011-effect-ts-adoption.md) | Whether Effect-TS as Core Runtime Foundation | Accepted | 2026-04-03 |
| [012](./012-sqlite-phase-1-2-primary-store.md) | Whether SQLite as Phase 1-2 Only Primary Storage | Accepted | 2026-04-03 |
| [013](./013-eventemitter-phase-2-boundary.md) | Whether EventEmitter Continues to Phase 2 | Accepted | 2026-04-03 |
| [014](./014-org-model-code-boundary.md) | Whether Organization Model Directly Maps to Code Objects | Accepted | 2026-04-03 |
| [015](./015-unified-extension-marketplace.md) | Whether Skill and Plugin Converge to Single Marketplace | Accepted | 2026-04-03 |
| [016](./016-oapeflir-loop-model.md) | OAPEFLIR Eight-Phase Cognitive Loop Model | Accepted | 2026-04-17 |
| [017](./017-knowledge-architecture-refactor.md) | Knowledge Three-Index Architecture Refactor | Accepted | 2026-04-17 |
| [018](./018-rollout-eleven-state-machine.md) | Rollout Eleven-State Machine and Six-Phase Release | Accepted | 2026-04-17 |
| [019](./019-agent-handoff-four-layer-protocol.md) | Agent Handoff Four-Layer Serialization Protocol | Accepted | 2026-04-17 |
| [020](./020-memory-six-plane-model.md) | Memory Six-Layer Plane and Auto-Promotion Rules | Accepted | 2026-04-17 |

## Status Description

- **Draft**: Under discussion, decision not yet made
- **Proposed**: Submitted, waiting for approval
- **Accepted**: Accepted and implemented
- **Superseded**: Superseded by new ADR
- **Deprecated**: Deprecated

## Creating New ADR

New ADR should follow standard template, numbering sequentially. For details refer to [../governance/source_of_truth.md](../governance/source_of_truth.md).
