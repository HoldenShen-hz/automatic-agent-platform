# ADR-042 Progressive Autonomy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Agents of different maturity levels need different autonomous permissions, and newly onboarded agents should gradually earn trust.

## Decision

### Autonomy Levels

| Level | Name | Permissions |
|-------|------|-------------|
| 0 | supervised | Full human supervision |
| 1 | assisted | Assistance suggestions |
| 2 | partial_auto | Partial automation |
| 3 | high_auto | High automation |
| 4 | full_auto | Full automation |

### Promotion Rules

- Based on execution success rate
- Based on risk assessment results
- Based on human feedback
- Progressive promotion, avoiding leaps

### Demotion Rules

- Consecutive failures trigger demotion
- Risk events trigger demotion
- Users can manually demote

### Permission Boundaries

- Each level has clear permission scope
- High-risk operations require high level
- Key decisions retain human approval

## Consequences

Positive:
- Progressive authorization reduces risk
- Incentivizes agents to continuously improve
- Clear permission boundaries facilitate management

Negative:
- Promotion/demotion logic is complex
- Requires comprehensive monitoring and evaluation mechanisms

Trade-offs:
- Trust vs. safety
- Efficiency vs. control

## Cross-References

- [ADR-041 Proactive Agent Framework](./041-proactive-agent-framework.md)
- [ADR-083 Proactive Agent and Progressive Autonomy](./083-proactive-agent-and-progressive-autonomy.md)

## Source Sections

- `§42` Gradual Autonomy