# ADR-042 Progressive Autonomy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Agents at different maturity levels need different autonomy permissions. Newly onboarded agents should gradually earn trust.

## Decision

### Autonomy Levels (§42 Five-Level Model)

| Level | Name | Permission |
|-------|------|------|
| 0 | manual_only | Manual operation only, no automation |
| 1 | suggestion | Suggestions only, requires human confirmation |
| 2 | supervised | Fully human-supervised execution |
| 3 | semi_auto | Semi-automatic, can execute automatically but requires human oversight |
| 4 | full_auto | Fully automated |

Rules:

- `full_auto` does not represent unlimited automation.
- High-risk domains are not allowed to enter `full_auto` by default, unless there is explicit `DomainRiskSpec` / `DomainRiskProfile` allowance with human accountability boundaries.
- If a domain is marked as `advisory_only`, `human_accountable`, or `deterministic_hot_path_only`, the autonomy level ceiling must be below `full_auto`.

### Promotion Rules

- Based on execution success rate
- Based on risk assessment results
- Based on human feedback
- Progressive promotion, avoiding leaps

### Demotion Rules

- Continuous failures trigger demotion
- Risk events trigger demotion
- Users can manually demote

### Permission Boundaries

- Each level has clear permission scope
- High-risk operations require higher levels
- Key decisions retain human approval

## Consequences

Pros:

- Progressive authorization reduces risk
- Incentivizes agents to continuously improve
- Clear permission boundaries facilitate management

Cons:

- Promotion/demotion logic is complex
- Requires完善的监控和评估机制

## Cross-references

- [ADR-041 Proactive Agent Framework](./041-proactive-agent-framework.md)
- [ADR-083 Proactive Agent and Progressive Autonomy](./083-proactive-agent-and-progressive-autonomy.md)

## Source Section

- `§42` Progressive Autonomy Model

## v4.3 ADR Remediation

- A-34: This ADR originally described level 4 `full_auto` as "fully automated". Root cause: the progressive autonomy ADR mistakenly wrote autonomy levels as an unlimited authorization ladder, without binding to high-risk domain risk override rules. Fix: The text now clarifies that high-risk domains are not allowed `full_auto` by default, unless explicitly allowed by `DomainRiskSpec / DomainRiskProfile`.
