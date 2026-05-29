# Architecture Design vs Implementation Remaining Work Plan

**Version**: v1.0
**Date**: 2026-04-22
**Basis**: `docs_zh/reviews/architecture-design-vs-implementation-review.md`

## Closed Items

- P0: Dockerfile entry, Redis error logs, DLQ persistence, queue.catch cleanup
- P1: CAS status migration, Outbox integration, SLO alerts, StructuredLogger async, session fdatasync
- P2: Prometheus rules, OTEL default enable, KEYS→SCAN, spawnSync removal, Map TTL, startup validation, path traversal, docker-compose credentials, deploy script guardrail, Helm domain configuration, Fluentd backoff
- P3: Route deduplication, Outbox batch, ServiceRegistry migration, PagerDuty URL configuration

## Long-term Evolution Items

### 1. Large Class Splitting

- Continue evaluating high-risk files with `>800 LOC`.
- Split into clearly Responsibility-defined subclasses while maintaining original interface compatibility.

### 2. `Record<string, unknown>` Convergence

- Prioritize constraining tool input/output, event payload, delegation schema.
- Progressively replace via high-value entry points, no one-time full repository rewrite.

### 3. Zod Runtime Validation Completion

- Prioritize coverage for API handler, tool executor, config loader.
- Goal is to explicitly call `z.parse()` at key external input boundaries.

### 4. ops-maturity Leaf Tool Enhancement

- Supplement real behavior for leaf modules that currently only retain thin entry points.
- First judge whether continued productization is worthwhile based on interface definitions and call chains.

### 5. limit-only Query Optimization

- Deep pagination queries like task list, DLQ, worker list prioritize adding cursor/pagination semantics.

## Description

- This file is the Chinese mirror of `docs_en/reviews/architecture-remaining-plan.md`.
- This only tracks "remaining evolution items", does not replace current active review/todo list.