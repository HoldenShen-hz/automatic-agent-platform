# ADR-042 Progressive Autonomy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Agents with different maturity levels require different autonomy permissions. Newly onboarded agents should progressively earn trust.

## Decision

### Autonomy Levels

| Level | Name | Permission |
|-------|------|------------|
| 0 | supervised | Full human supervision |
| 1 | assisted | Assisted suggestions |
| 2 | partial_auto | Partial automation |
| 3 | high_auto | High automation |
| 4 | full_auto | Full automation |

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
- Critical decisions retain human approval

## Consequences

Positive:

- Progressive authorization reduces risk
- Encourages continuous agent improvement
- Clear permission boundaries facilitate management

Negative:

- Promotion/demotion logic is complex
- Requires comprehensive monitoring and evaluation mechanisms

## Cross-References

- [ADR-041 Proactive Agent Framework](./041-proactive-agent-framework.md)
- [ADR-083 Proactive Agent and Progressive Autonomy](./083-proactive-agent-and-progressive-autonomy.md)

## Source Sections

- `§42` Progressive Autonomy Model

## v4.3 ADR Remediation

- A-34: This ADR originally described level 4 `full_auto` as "full automation". The root cause was that the Progressive Autonomy ADR mistakenly wrote autonomy levels as an unlimited authorization ladder, without binding to high-risk domain risk override rules. Fix: The main text now explicitly states that high-risk domains cannot enter `full_auto` by default, unless there is explicit `DomainRiskSpec` / `DomainRiskProfile` allowance.
