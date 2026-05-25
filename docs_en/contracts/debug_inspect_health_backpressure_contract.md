# Debug Inspect Health Backpressure Contract

## Purpose
Defines the minimum contract baseline for debug, inspect, health, and backpressure outputs across observability and control-plane flows.

## Canonical Implementation
- `src/platform/shared/observability/`
- `src/platform/five-plane-control-plane/incident-control/`
- `src/platform/five-plane-interface/channel-gateway/`

## Core Constraints
- Health and backpressure signals must surface through structured logs, explicit status results, or observable events.
- Inspect/debug outputs are operational views and must not masquerade as business truth.
- Missing metrics must fail closed rather than being treated as healthy by default.

## Notes
- This document defines a contract baseline and does not freeze every metric name.
- Exact metrics, log fields, and event shapes are owned by the corresponding runtime/exporter implementations.
