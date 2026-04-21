# ADR-041 Proactive Agent Framework

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Agents cannot only passively respond to requests; they also need to proactively perceive environmental changes and take actions.

## Decision

### TriggerDefinition

```typescript
interface TriggerDefinition {
  trigger_id: string;
  name: string;
  type: TriggerType;
  condition: TriggerCondition;
  action: TriggerAction;
  max_fire_rate: number;
  enabled: boolean;
}

type TriggerType = 'schedule' | 'event' | 'threshold' | 'webhook_inbound';
```

### TriggerAction

| Action Type | Description |
|-------------|-------------|
| create_task | Create task |
| create_goal | Create goal |
| suggest_to_user | Suggest to user |
| update_dashboard | Update dashboard |

### Trigger Storm Protection (4 layers)

| Layer | Mechanism |
|-------|-----------|
| Per-trigger rate limit | Default 10 times/hour |
| Cooldown period | Default 5 minutes |
| Circuit breaker | 3 consecutive failures = disable |
| Per-domain daily budget | dailyTriggerBudgetByDomain |

### TriggerEngine

- `proactive-agent/` (5 files, 694 lines)
- Evaluates trigger conditions
- Executes trigger actions
- Records trigger history

## Consequences

Positive:
- Proactive perception improves platform intelligence
- Multi-layer protection prevents trigger storms
- Multiple trigger types cover common scenarios

Negative:
- Proactive behavior may disturb users
- Trigger logic complexity is high

Trade-offs:
- Intelligence vs. intrusiveness
- Proactivity vs. overhead

## Cross-References

- [ADR-039 Natural Language Task Entry Architecture](./039-natural-language-task-entry.md)
- [ADR-083 Proactive Agent and Progressive Autonomy](./083-proactive-agent-and-progressive-autonomy.md)

## Source Sections

- `§41` Proactive Agent