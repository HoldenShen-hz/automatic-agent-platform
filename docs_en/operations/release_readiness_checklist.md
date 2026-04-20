# Release Readiness Checklist

## Pre-Code Baseline

- [ ] Main documents 00-07 established.
- [ ] Core contracts established.
- [ ] Review and readiness/gap documents established.
- [ ] Implementation plan established.

## Before First Implementation

- [ ] `src/` directory structure determined.
- [ ] `config/` directory structure determined.
- [ ] First batch contracts refined enough to drive code.
- [ ] Phase 1a scope frozen.

## Before First Release

- [ ] Key path tests passed.
- [ ] Approval and cost guard tests passed.
- [ ] Recovery process verified.
- [ ] Disaster recovery playbook documented.
- [ ] Rollback strategy documented.

## Current Automation Baseline

- `stable-gate` now outputs structured `requiredCriteria/optionalCriteria` gate results.
- `stable-package` now generates `stable-release-checklist.json`, converging smoke/long-run soak/recovery/disaster recovery/rolling upgrade/rollback/runbook/ownership items into formal checklist artifact.
- `stable-restore` now generates `stable-backup-restore-report.json` and `stable-disaster-recovery-playbook.json`, with `stable-gate`/`stable-package` explicitly checking disaster recovery readiness.
- `stable-upgrade` now generates `stable-rolling-upgrade-report.json` and `stable-rolling-upgrade-playbook.json`, with `stable-gate`/`stable-package` explicitly checking rolling upgrade readiness.
- `stable-maintenance` now generates `stable-maintenance-report.json` and `stable-maintenance-playbook.json`, with `stable-gate`/`stable-package` explicitly checking maintenance handover readiness.
- `stable-gray` now generates `stable-gray-release-report.json` and `stable-gray-release-playbook.json`, with `stable-gate`/`stable-package` explicitly checking tenant-gray rollout readiness.
- `doctor`/`diagnostics`/`stable-evidence` now expose observability retention summary; `tier_2/tier_3` events and terminal session non-summary messages are controllably cleaned by retention period; `tier_1` audit events and historical summary chains are retained by default.
- Checklist only reflects currently integrated automation evidence; `24h/72h` long-run evidence and higher-level launch thresholds still need to continue supplementing per current plan.
