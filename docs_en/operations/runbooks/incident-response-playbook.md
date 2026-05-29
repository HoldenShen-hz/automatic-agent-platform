# Incident Response Playbook

## Severity Targets

| Severity | Acknowledge | Mitigate | RCA |
| --- | --- | --- | --- |
| `P1` | 15 min | 1 hour | 24 hours |
| `P2` | 1 hour | 4 hours | 48 hours |

Prometheus/Alertmanager mapping:

- `severity=page` or cross-region/core write path failure -> `P1`
- `severity=critical` -> defaults to `P1` handling; if impact expands to multi-region, core write path or tenant-level large-scale unavailability, escalate to `P0` war room mode
- `severity=warning` -> defaults to `P2` handling

## Response Process

1. **Confirm** alert authenticity and announce incident severity
2. **Designate** incident commander and communications owner
3. **Stabilize** platform: pause rollout, reduce blast radius, restore core availability
4. **Preserve** evidence, then execute destructive recovery actions
5. **Publish** internal/external updates until mitigation complete
6. **Record** root cause, contributing factors and clear follow-up actions

## Escalation Matrix

| From Severity | Trigger | To |
| --- | --- | --- |
| P2 | No progress in 30 min | P1 |
| P1 | Multi-region impact or >1hr no mitigation | War room + engineering lead |

## Notification Template

```
INCIDENT UPDATE [HH:MM UTC]
Severity: <P1/P2>
Status: Investigating/Stabilizing/Resolved
Impact: <affected services, user count if known>
Current Actions: <what team is doing now>
Next Update: <HH:MM+30m or sooner if material change>
```

## Postmortem Template

```markdown
## Incident: <title> (<date>)

### Summary
<one paragraph description>

### Timeline
- HH:MM - Event
- HH:MM - Action taken
- HH:MM - Resolved

### Root Cause
<technical root cause>

### Contributing Factors
1. <factor 1>
2. <factor 2>

### Action Items
| Action | Owner | Due |
| --- | --- | --- |
| <action> | <owner> | <date> |
```

## Common Commands

```bash
# Check system health
curl -f http://127.0.0.1:8010/healthz

# View recent errors
grep -r "ERROR" logs/ | tail -100

# View Pod status
kubectl get pods -n automatic-agent

# Check database connectivity
sqlite3 "${AA_DB_PATH:-data/sqlite/automatic-agent.db}" "SELECT COUNT(*) FROM sqlite_master"

# View audit trail
cat logs/audit.json | jq '. | select(.level=="error")'
```

## Grafana Dashboard

- Platform overview: `https://grafana.internal/d/platform-overview`
- Execution metrics: `https://grafana.internal/d/execution-metrics`
- Agent health: `https://grafana.internal/d/agent-health`