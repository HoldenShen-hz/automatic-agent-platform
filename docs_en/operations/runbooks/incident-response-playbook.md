# Incident Response Playbook

## Severity Targets

| Severity | Acknowledge | Mitigate | RCA |
| --- | --- | --- | --- |
| `P1` | 15 min | 1 hour | 24 hours |
| `P2` | 1 hour | 4 hours | 48 hours |

## Response Flow

1. **Confirm** alert fidelity and declare incident severity
2. **Appoint** incident commander and communications owner
3. **Stabilize** platform: pause rollouts, reduce blast radius, restore core availability
4. **Preserve** evidence before destructive recovery actions
5. **Publish** customer/internal updates on fixed cadence until mitigation completes
6. **Document** root cause, contributing factors, and concrete follow-up actions

## Escalation Matrix

| From Severity | Trigger | To |
| --- | --- | --- |
| P2 | No progress in 30 min | P1 |
| P1 | Multi-region impact or >1hr no mitigation | War room + engineering lead |

## Communication Template

```
INCIDENT UPDATE [HH:MM UTC]
Severity: <P1/P2>
Status: Investigating/Stabilizing/Resolved
Impact: <affected services, user count if known>
Current Actions: <what team is doing now>
Next Update: <HH:MM+30m or sooner if material change>
```

## Post-Incident Review Template

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

## CLI Commands

```bash
# Check system health
npm run healthz

# View recent errors
grep -r "ERROR" logs/ | tail -100

# Check pod status
kubectl get pods -n platform

# Check database connections
sqlite3 data/platform.db "SELECT COUNT(*) FROM sqlite_master"

# View audit trail
cat logs/audit.json | jq '. | select(.level=="error")'
```

## Grafana Dashboard

- Platform overview: `https://grafana.internal/d/platform-overview`
- Execution metrics: `https://grafana.internal/d/execution-metrics`
- Agent health: `https://grafana.internal/d/agent-health`