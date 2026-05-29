# Automatic Agent System Runbook

> Description: This runbook contains industrial-grade target state operational entries; items related to `canary / blue-green` correspond to subsequent industrial-grade release paths, and do not indicate that current phase1-4 authoritative release level has supported running levels beyond `off / suggest / shadow`.

## 1. API Latency Breach
- Symptoms: `aa_http_request_duration_seconds` P95/P99 exceeds alert threshold, `/healthz` degrades, user requests time out.
- Diagnose: Inspect Grafana latency panels, `kubectl top pods`, application logs, and PostgreSQL pool wait metrics.
- Mitigate: Scale API replicas, reduce admission concurrency, switch to cheaper/faster provider profile, and drain saturated worker shard.
- Escalate: If latency remains above SLO for 15 minutes, open incident and involve on-call DBA/platform owner.

## 2. Task Failure-Rate Spike
- Symptoms: `aa_task_failure_total / aa_task_total` rises above baseline, alert rules begin firing, retries cluster around single provider or workflow.
- Diagnose: Inspect failed executions by error code, confirm provider health, check approval and queue backlogs.
- Mitigate: Pause risky workflows, route traffic to fallback providers, replay safe failures after dependency recovers.
- Escalate: If failure rate stays above 5% for 30 minutes, declare incident.

## 3. PostgreSQL Pool Exhaustion
- Symptoms: Connection waiters increase, write latency spikes, health becomes `degraded`.
- Diagnose: Inspect `pg_stat_activity`, slow-query logs, and migration/maintenance jobs.
- Mitigate: Terminate zombie sessions, carefully increase pool limits, and stop non-critical background jobs.
- Escalate: If writes remain blocked or failover required, page DBA.

## 4. Redis Connectivity Failure
- Symptoms: Lock acquisition times out, queue latency increases, cache hit rate collapses.
- Diagnose: `redis-cli ping`, pod logs, network policy changes, and sentinel/managed Redis health.
- Mitigate: Fall back to SQLite-backed coordination where supported, restart affected pods, and isolate noisy queue consumers.
- Escalate: If reconnection does not recover within 10 minutes, involve platform networking.

## 5. Approval Delivery Outage
- Symptoms: Approval alerts fire without corresponding operator notifications, pending approval count grows.
- Diagnose: Verify Slack/PagerDuty/OpsGenie webhook delivery, inspect alert-event rows and runbook execution logs.
- Mitigate: Switch to log/webhook fallback, export pending approvals, pause high-risk tool execution.
- Escalate: If approval path unavailable for 15 minutes, trigger manual human review mode.

## 6. Canary Regression
- Symptoms: Canary error budget burn exceeds threshold, health checks fail, request latency diverges from stable.
- Diagnose: Compare `automatic-agent` and `automatic-agent-canary` rollout metrics, diff config/secret versions.
- Mitigate: Stop traffic increase, uninstall canary release, and redeploy stable.
- Escalate: If rollback does not restore SLOs within 10 minutes, open incident.

## 7. Blue/Green Cutover Failure
- Symptoms: Service selector patch succeeds but traffic still returns 5xx or stale responses.
- Diagnose: Inspect service selectors, ingress backends, and release-specific pods.
- Mitigate: Patch service selector back to previous color, verify health, and postpone promotion.
- Escalate: If both colors unhealthy, move to incident command.

## 8. Secret Rotation Failure
- Symptoms: Authentication failures after rotation, secret lease records show mismatched versions.
- Diagnose: Inspect `secret_rotation_events`, external secret controller status, and provider-specific audit trails.
- Mitigate: Roll back to previous secret version, restart pods that cache credentials, and validate no cleartext logged.
- Escalate: If credential recovery requires manual vault changes, involve security engineering.

## 9. Hot-Upgrade Rehearsal Regression
- Symptoms: Rolling upgrade creates orphan tasks, websocket disconnects spike, or P99 doubles during rollout.
- Diagnose: Inspect stable upgrade rehearsal evidence, task lease ownership, and coordinator election logs.
- Mitigate: Stop rollout, hold at current revision, and restore last verified image tag.
- Escalate: If request loss occurs during upgrade, block production promotion until new rehearsal passes.

## 10. Observability Export Loss
- Symptoms: `/metrics` or dedicated metrics port returns errors, external alert channels stop receiving events.
- Diagnose: curl metrics endpoint, inspect transport logs, and confirm secret/config drift.
- Mitigate: Restore in-process metrics server, switch alerts to log delivery, and extend manual monitoring cadence.
- Escalate: If observability loss exceeds one SLO window, open incident.