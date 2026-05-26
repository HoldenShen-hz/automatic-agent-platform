# ADR-121 Timeout and Worker Liveness Hierarchy

- Status: Accepted
- Decision Date: 2026-05-25

## Background

The interface layer, gateway layer, and execution layer already define timeout and heartbeat parameters, but the hierarchy between them had not been documented clearly. Reviews therefore conflated thresholds that serve different goals.

## Decision

### 1. HTTP timeout hierarchy

- server socket timeout must be greater than or equal to request handler timeout
- request handler timeout must be greater than or equal to downstream channel gateway or request adapter timeout
- default intent:
  - socket timeout sets the upper bound for connection lifetime
  - handler timeout sets the upper bound for a single API handling path
  - gateway timeout sets the upper bound for a single downstream call

### 2. Worker heartbeat threshold

- `DEFAULT_WORKER_HEARTBEAT_STALENESS_MS` is the worker liveness gate for local dispatch and handshake
- it is used to answer "can this worker be scheduled now?" and is not the cross-region failover RTO SLA
- cross-region RTO remains the responsibility of the failover, health-check, and reconciliation systems

### 3. Principles

- the local liveness gate may be much stricter than cross-region RTO
- "worker stale" must not be interpreted directly as "trigger region failover immediately"
- scheduling thresholds and failover thresholds must be tuned and observed separately

## Consequences

- a `30s` worker heartbeat staleness threshold and minute-level region RTO targets are no longer treated as a semantic conflict
- timeout configuration is now understood as layered design with distinct responsibilities, not as values that happen to match numerically
