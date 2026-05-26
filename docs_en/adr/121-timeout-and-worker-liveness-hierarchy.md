# ADR-121 Timeout And Worker Liveness Hierarchy

- Status: Accepted
- Decision Date: 2026-05-25

## Background

Interface layer, gateway layer, execution layer all have timeout/heartbeat parameters, but previously no unified explanation of their hierarchy, causing reviews to mix multiple different-purpose thresholds.

## Decision

### 1. HTTP Timeout Hierarchy

- Server socket timeout must be greater than or equal to request handler timeout.
- Request handler timeout must be greater than or equal to downstream channel gateway/request adapter timeout.
- Default semantics:
  - Socket timeout responsible for connection lifecycle upper bound
  - Handler timeout responsible for single API processing upper bound
  - Gateway timeout responsible for single external call upper bound

### 2. Worker Heartbeat Threshold

- `DEFAULT_WORKER_HEARTBEAT_STALENESS_MS` is the local dispatch/handshake worker liveness gate.
- It is used to quickly determine "whether this worker can currently be scheduled", not cross-region failover RTO SLA.
- Cross-region RTO still handled by failover / health-check / reconciliation system.

### 3. Principles

- Local liveness gate can be much stricter than cross-region RTO.
- Do not directly interpret "worker stale" as "should immediately trigger region failover".
- Scheduling threshold and failover threshold must be separately tuned, separately observed.

## Result

- `30s` worker heartbeat stale threshold and `minutes` level region RTO target no longer viewed as semantic conflict.
- Design intent of timeout configuration changed from "numerical coincidence" to "explicit layering, each with its role".
