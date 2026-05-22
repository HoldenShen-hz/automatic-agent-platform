# Production Alert Runbook

This runbook maps 1:1 to the alert names defined in `deploy/prometheus/rules/automatic-agent.yml`.

## 1. AutomaticAgentMetricsEndpointDown
- Confirm `/metrics` is reachable from Prometheus and the service endpoint is still registered.
- Check the API process, container restart count, and network path between Prometheus and the target.
- Open an incident if scraping is still down after one restart attempt.

## 2. AutomaticAgentNoTraffic
- Verify ingress, load balancer, and upstream schedulers are still forwarding requests.
- Compare `http_requests_total` with business-side intake telemetry to rule out a false quiet period.
- Escalate if traffic is unexpectedly zero during a production window.

## 3. AutomaticAgentHighErrorRate
- Inspect 5xx logs by route and tenant, then isolate the dominant failing dependency.
- Pause new high-risk rollouts if the error budget burn is still rising.
- Roll back the most recent config or release when the failure correlates with a recent change.

## 4. AutomaticAgentHighLatency
- Compare recent latency histograms with queue depth, worker utilization, and dependency timings.
- Reduce concurrency or enable degraded mode if p95 remains above SLO for two intervals.
- Capture the slowest route and dependency before closing the alert.

## 5. AutomaticAgentCriticalLatency
- Freeze promotions immediately and treat the alert as customer-visible degradation.
- Drain pathological backlog and shift traffic away from unhealthy nodes or regions.
- Keep the incident open until p95 is back under the critical threshold.

## 6. AutomaticAgentQueueDepthHigh
- Inspect queue age, admission control, and worker availability before scaling.
- Throttle non-critical work and confirm no stuck execution class is monopolizing workers.
- Track whether backlog is shrinking before returning the queue to normal mode.

## 7. AutomaticAgentQueueBacklog
- Page the execution owner and suspend new non-essential submissions.
- Drain dead-letter or blocked partitions only after validating idempotency protections.
- Scale workers or rollback the source of the surge before re-enabling normal intake.

## 8. AutomaticAgentWorkerPoolExhaustion
- Verify worker registration, healthy heartbeat count, and lease allocation fairness.
- Shift low-priority jobs to backlog if worker utilization stays above 90%.
- Review recent deploys for concurrency regressions before closing the alert.

## 9. AutomaticAgentWorkerPoolCritical
- Treat worker saturation as an active capacity incident.
- Stop canary expansion, scale emergency workers, or shed non-critical load.
- Keep dispatch throttled until utilization and queue age recover together.

## 10. AutomaticAgentTaskTimeoutRate
- Identify the dominant timeout class and confirm whether retries are amplifying the incident.
- Compare dependency latency with task timeout policy to separate infra from config drift.
- Reduce parallelism or raise manual review gates before resuming full traffic.

## 11. AutomaticAgentOutboxGrowing
- Validate downstream webhooks, connectors, and outbox drains are still progressing.
- Check whether one tenant or connector is blocking the outbox head.
- Confirm pending entries resume draining after remediation.

## 12. AutomaticAgentOutboxBacklog
- Pause non-essential event production to stop further backlog growth.
- Repair the failing downstream route or replay worker before bulk replay.
- Resume producers only after the backlog trend turns downward.

## 13. AutomaticAgentDLQAccumulating
- Sample the newest DLQ records and classify them by transient vs permanent failure.
- Confirm duplicate-delivery protections before replaying any batch.
- Open a follow-up defect if the same failure signature repeats.

## 14. AutomaticAgentDLQCritical
- Escalate to the owning team immediately and freeze automatic replay.
- Snapshot representative DLQ payloads and preserve evidence for RCA.
- Only resume replay after the root cause fix has been validated.

## 15. AutomaticAgentTaskFailureRate
- Break down failures by task type, model/provider, and tenant.
- Roll back the failing workflow or dependency change when failure concentration is obvious.
- Keep the incident open until the failure rate returns below threshold.

## 16. AutomaticAgentMemoryPressure
- Inspect heap, resident memory, and recent workload spikes on the affected instance.
- Restart only after capturing enough evidence to distinguish leak vs bursty workload.
- Reduce batch sizes or disable offending features if memory pressure persists.

## 17. AutomaticAgentRedisDisconnected
- Validate Redis reachability, auth settings, and recent credential rotations.
- Switch to degraded behavior for Redis-backed subsystems if supported.
- Do not close until error counters stop increasing.

## 18. AutomaticAgentEventLoopLag
- Capture CPU profile or blocking operation evidence on the affected instance.
- Reduce heavy synchronous workloads and check recent code paths for blocking I/O.
- Confirm event loop lag and request latency both recover.

## 19. AutomaticAgentDiskUsageHigh
- Inspect artifact growth, local evidence retention, and failed cleanup jobs.
- Free space only after preserving incident evidence and required runtime state.
- Add follow-up work if retention or cleanup policy caused the pressure.

## 20. AutomaticAgentWorkerHeartbeatTimeout
- Enumerate unhealthy workers and compare heartbeat timestamps with lease ownership.
- Treat correlated heartbeat loss across many workers as a Worker Mass Disconnect event and freeze non-essential dispatch.
- Fence stale owners before reassigning work.
- Validate that recovered workers can re-register cleanly.

## 21. AutomaticAgentOrchestrationLatency
- Compare orchestration stage timings to planner, HITL, and downstream execution dependencies.
- Pause rollout of recent orchestration changes if latency regression is new, and classify progressive degradation during rollout as Canary Health Regression.
- Keep traces and stage breakdowns attached to the incident record.
