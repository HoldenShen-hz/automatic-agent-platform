# Disaster Recovery Runbook

This document supplements ADR-031 with execution steps for region unavailability, database write failures, queue unavailability, and critical runtime recovery.

## Triggers

- Primary region API, worker, or database continuously unavailable beyond RTO threshold.
- Data writes fail and cannot be recovered through partial retries.
- Queue or event evidence chain faces unacceptable latency or loss risk.

## Preparation Checks

1. Confirm incident commander and approvers.
2. Freeze non-essential deployments.
3. Export current health checks, queue depth, database replication status, and recent event evidence.
4. Confirm backup snapshots, recovery points, and target region capacity.

## Recovery Steps

1. Switch ingress traffic to standby region or degraded ingress.
2. Start standby workers and control plane services.
3. Restore database to target recovery point and execute read-only validation.
4. Restore queue consumption; enable low concurrency first, then gradually restore normal concurrency.
5. Execute runtime recovery targeted checks; confirm stale, blocked, dead-letter views are available.
6. Record recovery window, data gaps, and manual approval actions.

## Rollback

- If standby region recovery fails, stop new writes and remain read-only.
- Before reverting traffic, confirm primary region write path and event evidence chain are consistent.

## Evidence

- Health check output.
- Database recovery logs.
- Queue depth and consumer recovery records.
- Runtime recovery report.
- Postmortem.