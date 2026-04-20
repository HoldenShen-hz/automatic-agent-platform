# Production Alert Runbook

This runbook groups the minimum operational responses required before production promotion.

## 1. Worker Mass Disconnect
- Confirm heartbeat loss scope from `doctor` and `/healthz`.
- Pause new dispatch when disconnects exceed the configured threshold.
- Drain orphan leases and restart affected workers.

## 2. Provider 429 / 5xx Spike
- Switch routing to the fallback provider profile.
- Confirm cooldown lease was recorded.
- Verify no retry storm is in progress.

## 3. Queue Backlog Breach
- Inspect backlog depth and oldest age.
- Enable admission control degradation.
- Drain DLQ if duplicate deliveries are contained.

## 4. Approval Channel Unavailable
- Route approvals to backup webhook or Slack.
- Freeze high-risk tool execution until approval delivery recovers.
- Export pending approvals for manual fallback.

## 5. Cost Spike Containment
- Trigger budget guardrails.
- Reduce expensive provider usage to cheap-vs-strong fallback.
- Review top task and tenant contributors.

## 6. Database Lock Contention
- Check SQLite/PG lock holders.
- Kill zombie processes before retrying migrations or writes.
- Fail-close any deployment depending on a writable schema.

## 7. Stale Lease Repair
- Enumerate stale execution tickets.
- Fence old owners before redispatch.
- Verify repaired tasks resume from a valid step boundary.

## 8. Secret Rotation Failure
- Validate external secret provider health.
- Roll back to the previous known-good secret version if rotation is incomplete.
- Confirm no cleartext secret leaked into logs or artifacts.

## 9. Canary Health Regression
- Stop traffic shift at current percentage.
- Compare canary and stable worker metrics.
- Roll back if error budget burn exceeds threshold.

## 10. Metrics / Alert Export Failure
- Validate `/prometheus` output and alert channel reachability.
- Fall back to log channel delivery if external alerting is unavailable.
- Open an incident if observability loss lasts beyond the configured SLO window.
