# ADR-121 Timeout and Worker Liveness Hierarchy

- Status: Accepted
- Decision Date: 2026-05-25

## Background

Interface layer, gateway layer, and execution layer all have timeout/heartbeat parameters, but previously there was no unified description of their hierarchical relationship, causing reviews to mix multiple thresholds with different targets.

## Decision

### 1. HTTP Timeout Hierarchy

- Server socket timeout must be greater than or equal to request handler timeout.
- Request handler timeout must be greater than or equal to downstream channel gateway/request adapter timeout.
- Default semantics:
  - Socket timeout is responsible for connection lifecycle upper bound
  - Handler timeout is responsible for single API handling upper bound
  - Gateway timeout is responsible for single external call upper bound

### 2. Worker Heartbeat Threshold

- `DEFAULT_WORKER_HEARTBEAT_STALENESS_MS` is the local dispatch/handshake worker liveness gate.
- It is用于快速判断 "whether this worker is currently schedulable", not cross-region failover RTO SLA.
- Cross-region RTO is still负责 by failover / health-check / reconciliation system.

### 3. Principles

- Local liveness gate can be much stricter than cross-region RTO.
- Do not allow directly interpreting "worker stale" as "should immediately trigger region failover".
- Scheduling threshold and failover threshold must be tuned and observed separately.

## Results

- `30s` worker heartbeat stale threshold and `minutes`-level region RTO target are no longer viewed as semantic conflict.
- Timeout configuration design intent changes from "numerical coincidence equal" to "clear layering, each with its own responsibility".