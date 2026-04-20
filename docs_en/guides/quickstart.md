# Quickstart

## Objective

This document helps you quickly find your reading path within the split documentation system and focus your attention on the infrastructure scope that should be prioritized for current implementation, rather than getting lost in ultra-long documents.

## Recommended Reading Order

1. First read [Platform Skeleton](../architecture/00-platform-architecture.md) to establish a global mental model.
2. Then read [ADR-001](../adr/001-three-layer-architecture.md), [ADR-004](../adr/004-workflow-routing.md), [ADR-009](../adr/009-deployment-ops.md) to understand the core main chain.
3. If currently implementing memory, cost, or security, read [ADR-003](../adr/003-memory-seven-layers.md), [ADR-008](../adr/008-cost-model.md), [ADR-005](../adr/005-security-model.md) respectively.
4. If currently adding new business capabilities, read [Division Authoring](./division-authoring.md) last.

## Current Recommended Implementation Scope

Prioritize only Phase 1a and Phase 1b required capabilities:

- Single Agent infrastructure core.
- VP Operations access and routing.
- Basic workflow state management.
- Message and event persistence.
- Cost guard and basic approval.
- Crash recovery.
- Multi-Agent orchestration minimum happy path.

Do NOT implement ahead of time:

- Multi-tenancy.
- Marketplace.
- Complete 8-dimensional evolution.
- Full long-term memory/knowledge governance capabilities rolled out at once.
- Too many division deployments.
- Complex web experience and enterprise compliance capabilities.

## Phase 1a Implementation Order Recommendation

1. Establish project directory and configuration skeleton.
2. Implement minimum storage models for tasks, sessions, events, and workflow state.
3. Complete single task from reception, execution to return happy path.
4. Add cost guard, basic approval, and error system.

## Phase 1b Enhancement Recommendation

1. Introduce VP Operations, VP Orchestration, and basic task dashboard.
2. Complete cross-division breakdown and result aggregation.
3. Add recovery, self-healing, and streaming output.
4. Reserve hooks for future memory and governance.

## Documentation Conventions

- The main document explains "what the platform is."
- ADRs explain "why this design was chosen."
- Guides explain "how to do it specifically."
- Deduplicated archived versions serve as historical references only; no longer the preferred entry point.
