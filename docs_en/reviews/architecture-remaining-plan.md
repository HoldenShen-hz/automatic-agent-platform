# Architecture Design Implementation Remaining Work Plan

**Version**: v1.0
**Date**: 2026-04-22
**Based on**: docs_zh/reviews/architecture-design-vs-implementation-review.md v4.2

---

## 1. Closed Items Confirmed (No Further Action Needed)

| Category | Items | Status |
|----------|-------|--------|
| P0 | Dockerfile entry, Redis error logs, DLQ persistence, queue.catch cleanup | ✅ Completed |
| P1 | CAS state transitions, Outbox integration, SLO alerts, StructuredLogger async, session fdatasync | ✅ Completed |
| P2 | Prometheus rules (16), OTEL enabled by default, KEYS→SCAN, spawnSync removal, Map TTL, startup validation, path traversal, docker-compose credentials, deployment script guardrails, Helm domain, Fluentd backoff | ✅ Completed |
| P3 | Route deduplication, Outbox batch, ServiceRegistry migration, PagerDuty URL configurable | ✅ Completed |

---

## 2. Remaining Long-Term Evolution Items (ℹ️ Non-Urgent)

### 2.1 P3.26 Giant Class Consolidation (5 person-days)

**Current state**: 10 files >800 lines, but significant improvement achieved

**Target files**:
1. `HumanTakeoverServiceAsync` - Already split out TakeoverQueueManager/TakeoverEscalationManager
2. Other large files pending evaluation

**Approach**: Extract cohesive method groups into smaller classes, maintain original interface compatibility

---

### 2.2 P3.28 Record<string,unknown> Type Improvement (5-8 person-days)

**Current state**: 822 occurrences, but mainly for open JSON envelope modeling

**High-value improvement points**:
1. `delegation-types.ts` - Constrain schema types (partially done)
2. Tool input/output types
3. Event payload types

**Approach**: Incremental replacement, prioritize high-value points

---

### 2.3 P3.29 Zod Schema Validation Balance (3 person-days)

**Current state**: Declaration/validation 3:1 imbalance

**Improvement points**:
1. API handlers receiving external data
2. Tool executor input validation
3. Config loaders runtime validation

**Approach**: Add z.parse() calls at key entry points

---

### 2.4 P3.31 ops-maturity Leaf Tool Enhancement (5-10 person-days)

**Current state**: Some files <50 lines but functionality is complete

**To enhance**:
1. `incident-diagnoser/index.ts` (9 lines)
2. `config-optimizer/index.ts` (7 lines)
3. `dev-assistant/index.ts` (7 lines)

**Approach**: Expand functionality based on interface definitions

---

### 2.5 P3.32 limit-only Query Optimization (2 person-days)

**Current state**: Internal queries use LIMIT without cursors

**Improvement points**:
1. Task list deep pagination
2. DLQ queries
3. Worker list

**Approach**: Add cursor parameter

---

## 3. Execution Plan

### Phase 1: Closure Verification (1 hour)
- Confirm all ✅ items are actually implemented
- Verify build passes

### Phase 2: Quick Fixes (2-3 hours)
1. P3.32 limit-only query - cursor pagination
2. P3.29 Zod validation - add validation to high-risk entry points

### Phase 3: Long-term Evolution (as needed)
- P3.26 giant classes - refactor gradually by priority
- P3.28 types - incremental replacement
- P3.31 leaf tools - functionality enhancement

---

## 4. Verification Checklist

```
[ ] npm run build passes
[ ] npm run test passes
[ ] No new TypeScript errors
[ ] All section statuses match documentation
```

---

**Document End**
