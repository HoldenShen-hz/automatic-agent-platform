# Event Registry And Ops Threshold Contract

## Purpose
Aligns event registry ownership, default Tier-1 consumer discovery, and operational thresholds.

## Core Rules
- Default Tier-1 consumers are derived from the event schema registry.
- Event ops must not maintain a second manual allowlist.
- Replay and drain thresholds must be explicitly documented.

## Relevant Code
- `src/platform/five-plane-state-evidence/events/event-registry.ts`
- `src/platform/five-plane-state-evidence/events/event-ops-service.ts`

