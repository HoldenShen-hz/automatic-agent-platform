# ADR-020 Memory Six-Plane Model and Automatic Promotion Rules

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Signal collection and unified DTO
- **Assess**: Pre/post-execution assessment and risk judgment
- **Plan**: Explicit planning and DAG construction (ADR-060)
- **Execute**: Step execution and Dual-Channel output
- **Feedback**: Signal collection, preprocessing, and 7 types of feedback sources (ADR-079)
- **Learn**: Pattern detection and knowledge extraction (ADR-080)
- **Improve**: Improvement candidate evaluation and Rollout state machine (ADR-075)
- **Release**: Six-level controlled release and automatic rollback

---

- Status: Accepted
- Decision Date: 2026-04-17

## Context

The §F design document defines a six-layer Memory plane (L1-L6) and inter-layer promotion rules. Currently, `memory/` implements L1-L3 (RuntimeCache / Session / Agent), with L4-L6 (Project / User / Evolution) missing, and no automatic promotion engine.

## Decision

### Six-Layer Memory Plane

| Layer | Name | Granularity | TTL | Storage Location |
|-------|------|-------------|-----|------------------|
| **L1** | RuntimeCache | task-level | During execution | Memory |
| **L2** | Session | session-level | 24h after session ends | SQLite |
| **L3** | Agent | agent-level | 7 days without access | SQLite |
| **L4** | Project | project-level | 30 days without access | SQLite |
| **L5** | User | user-level | 90 days without access | SQLite |
| **L6** | Evolution | global | Manual deletion only | SQLite |

### Inter-Layer Promotion Rules

| Promotion Path | Trigger Condition | Check Frequency |
|----------------|-------------------|-----------------|
| L2 → L3 | accessCount ≥ 3 **AND** qualityScore ≥ 0.6 | Hourly batch |
| L3 → L4 | accessCount ≥ 10 **AND** qualityScore ≥ 0.8 | Hourly batch |
| L4 → L5 | accessCount ≥ 20 **AND** qualityScore ≥ 0.85 | Daily batch |
| L5 → L6 | manual promotion only | — |

### MemoryPromotionEngine Interface

```typescript
interface MemoryPromotionEngine {
  // Evaluate whether a single record meets promotion criteria
  evaluatePromotion(entry: MemoryRecord): PromotionDecision;
  // Batch scan and execute promotions
  runPromotionCycle(): Promise<PromotionResult>;
  // Demotion rules (reverse direction)
  evaluateDemotion(entry: MemoryRecord): DemotionDecision;
}
```

### Current Implementation Status

- `src/core/memory/memory-service.ts`: L1-L3 implemented.
- `src/core/memory/memory-layer-model.ts`: To be created (layer definitions).
- `src/core/memory/memory-promotion-engine.ts`: To be created (promotion engine).
- `src/core/memory/project-memory-store.ts`: To be created (L4).
- `src/core/memory/user-memory-store.ts`: To be created (L5).

## Consequences

- The six-layer Memory model gives the system a complete lifecycle from "execution-time cache" to "long-term knowledge accumulation".
- L4-L6 is the infrastructure for implementing "project memory" and "user preference learning".
- Promotion rules ensure that high-frequency, high-quality memories automatically move to more persistent layers, while low-value memories naturally decay.
