# Disaster Recovery Runbook

This document supplements ADR-031's execution steps, for regional unavailability, database unwritable, queue unavailable, and critical runtime recovery.

Current execution baseline aligned with `config/dr/default.json`:

- `RTO <= 1 hour`
- `RPO <= 5 minutes`

## Triggers

- Primary region API, worker or database continuously unavailable exceeds RTO threshold.
- Data writes fail and cannot be recovered through partial retry.
- Queue or event evidence chain shows unacceptable delay or loss risk.

## Preparation Checks

1. Confirm incident commander and approvers.
2. Freeze non-essential deployments.
3. Export current health check, queue depth, database replication status, and recent event evidence.
4. Confirm backup snapshots, recovery points, and target region capacity.
5. Use `bash deploy/scripts/dr-drill.sh --mode verify --component all --output-dir .dr-reports/manual-verify` to first verify existing backups are readable.

## Recovery Steps

1. Switch entry traffic to standby region or degraded entry.
2. Start standby workers and control plane services.
3. Restore database to target recovery point, and execute read-only verification.
4. Restore queue consumption; first enable low concurrency, then gradually restore normal concurrency.
5. Execute runtime recovery targeted checks; confirm stale, blocked, dead-letter views are available.
6. Record recovery window, data gap, and manual approval actions.

## Rollback

- If standby region recovery fails, stop new writes and maintain read-only status.
- Before rolling back traffic, must confirm primary region write path and event evidence chain are consistent.

## Evidence

- Health check output.
- Database recovery logs.
- Queue depth and consumption recovery records.
- Runtime recovery report.
- Postmortem.