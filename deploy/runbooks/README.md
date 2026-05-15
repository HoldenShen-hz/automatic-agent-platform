# Deployment Runbooks

Runbooks in this directory are production-facing operational procedures. Keep them short, executable, and linked to evidence paths.

## Required Runbook Types

- Alert triage and escalation.
- Rollback and failed deployment recovery.
- Database or queue degradation.
- Plugin/runtime failure containment.
- Cross-region or multi-region failover.

## Authoring Rules

- Include symptoms, first checks, mitigation, rollback, and evidence collection.
- Prefer commands that already exist under `npm run` or `scripts/runtime/`.
- Do not include secrets, tokens, or customer data.
- Link to `docs_zh/operations/runbooks/` when a longer operational playbook exists.
