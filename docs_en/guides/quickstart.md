# Quickstart

## Goal

This document helps you quickly find your reading path within the split documentation structure and focus your attention on the infrastructure scope that should be implemented right now, rather than getting lost in overly long documents.

## Recommended Reading Order

1. First read [automatic-agent-architecture.md](../automatic-agent-architecture.md) to build a global mental model.
2. Then read [ADR-001](../adr/001-three-layer-architecture.md), [ADR-004](../adr/004-workflow-routing.md), [ADR-009](../adr/009-deployment-ops.md) to understand the core main path.
3. If you are currently implementing memory, cost, or security, also read [ADR-003](../adr/003-memory-seven-layers.md), [ADR-008](../adr/008-cost-model.md), [ADR-005](../adr/005-security-model.md).
4. If you need to add new business capabilities, finish reading [Division Authoring](./division-authoring.md).

## Current Recommended Implementation Scope

Focus only on Phase 1a and Phase 1b required capabilities:

- Core single-agent infrastructure.
- VP operations integration and routing.
- Basic workflow state management.
- Message and event persistence.
- Cost guards and basic approval.
- Crash recovery.
- Minimum happy path for multi-agent orchestration.

What not to do ahead of time:

- Multi-tenancy.
- Marketplace.
- Complete 8-dimensional evolution.
- Complete long-term memory/knowledge governance capabilities all at once.
- Excessive division expansion.
- Complex web experiences and enterprise compliance capabilities.

## Phase 1a Implementation Sequence Suggestions

1. Set up project directory and configuration skeleton.
2. Implement the minimum storage model for tasks, sessions, events, and workflow state.
3. Complete the happy path from task receipt through execution to response.
4. Add cost guards, basic approval, and error handling.

## Phase 1b Enhancement Suggestions

1. Introduce VP operations, VP orchestration, and basic task dashboards.
2. Enable cross-division task splitting and result aggregation.
3. Add recovery, self-healing, and streaming output.
4. Add instrumentation points for future memory and governance.

## Documentation Conventions

- Master document is responsible for explaining "what the platform is".
- ADR is responsible for explaining "why this design was chosen".
- Guides are responsible for explaining "how to do it specifically".
- Deduplicated archived version serves only as historical reference, no longer the preferred entry point.
