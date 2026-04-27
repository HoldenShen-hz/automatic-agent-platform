# Automatic Agent System Runbook

> Note: This runbook contains industrial-grade target state operational items; items related to `canary / blue-green` correspond to subsequent industrial-grade release paths, and do not indicate that the current phase1-4 authoritative release level supports running levels beyond `off / suggest / shadow`.

## 1. API latency breach
- Symptoms: `aa_http_request_duration_seconds` P95/P99 exceeds the alert threshold, `/healthz` degrades, user requests time out.
- Diagnose: inspect Grafana latency panels, `kubectl top pods`, application logs, and PostgreSQL pool wait metrics.
- Mitigate: scale API replicas, reduce admission concurrency, switch to cheaper/faster provider profile, and drain a saturated worker shard.
- Escalate: if latency remains above SLO for 15 minutes, open an incident and involve the on-call DBA/platform owner.

## 2. Task failure-rate spike
- Symptoms: `aa_task_failure_total / aa_task_total` rises above baseline, alert rules begin firing, retries cluster around a single provider or workflow.
- Diagnose: inspect failed executions by error code, confirm provider health, check approval and queue backlogs.
- Mitigate: pause risky workflows, route traffic to fallback providers, replay safe failures after the dependency recovers.
- Escalate: if failure rate stays above 5% for 30 minutes, declare an incident.

## 3. PostgreSQL pool exhaustion
- Symptoms: connection waiters increase, write latency spikes, health becomes `degraded`.
- Diagnose: inspect `pg_stat_activity`, slow-query logs, and migration/maintenance jobs.
- Mitigate: terminate zombie sessions, increase pool limits carefully, and stop non-critical background jobs.
- Escalate: if writes remain blocked or failover is required, page the DBA.

## 4. Redis connectivity failure
- Symptoms: lock acquisition times out, queue latency increases, cache hit rate collapses.
- Diagnose: `redis-cli ping`, pod logs, network policy changes, and sentinel/managed Redis health.
- Mitigate: fall back to SQLite-backed coordination where supported, restart affected pods, and isolate noisy queue consumers.
- Escalate: if reconnection does not recover within 10 minutes, involve platform networking.

## 5. Approval delivery outage
- Symptoms: approval alerts fire without corresponding operator notifications, pending approval count grows.
- Diagnose: verify Slack/PagerDuty/OpsGenie webhook delivery, inspect alert-event rows and runbook execution logs.
- Mitigate: switch to log/webhook fallback, export pending approvals, pause high-risk tool execution.
- Escalate: if approval path is unavailable for 15 minutes, trigger manual human review mode.

## 6. Canary regression
- Symptoms: canary error budget burn exceeds threshold, health checks fail, request latency diverges from stable.
- Diagnose: compare `automatic-agent` and `automatic-agent-canary` rollout metrics, diff config/secret versions.
- Mitigate: stop traffic increase, uninstall the canary release, and redeploy stable.
- Escalate: if rollback does not restore SLOs within 10 minutes, open an incident.

## 7. Blue/green cutover failure
- Symptoms: service selector patch succeeds but traffic still returns 5xx or stale responses.
- Diagnose: inspect service selectors, ingress backends, and release-specific pods.
- Mitigate: patch the service selector back to the previous color, verify health, and postpone promotion.
- Escalate: if both colors are unhealthy, move to incident command.

## 8. Secret rotation failure
- Symptoms: authentication failures after rotation, secret lease records show mismatched versions.
- Diagnose: inspect `secret_rotation_events`, external secret controller status, and provider-specific audit trails.
- Mitigate: roll back to the previous secret version, restart pods that cache credentials, and validate no cleartext was logged.
- Escalate: if credential recovery requires manual vault changes, involve security engineering.

## 9. Hot-upgrade rehearsal regression
- Symptoms: rolling upgrade creates orphan tasks, websocket disconnects spike, or P99 doubles during rollout.
- Diagnose: inspect stable upgrade rehearsal evidence, task lease ownership, and coordinator election logs.
- Mitigate: stop rollout, hold at current revision, and restore the last verified image tag.
- Escalate: if request loss occurs during upgrade, block production promotion until a new rehearsal passes.

## 10. Observability export loss
- Symptoms: `/metrics` or dedicated metrics port returns errors, external alert channels stop receiving events.
- Diagnose: curl the metrics endpoint, inspect transport logs, and confirm secret/config drift.
- Mitigate: restore the in-process metrics server, switch alerts to log delivery, and extend manual monitoring cadence.
- Escalate: if observability loss exceeds one SLO window, open an incident.
