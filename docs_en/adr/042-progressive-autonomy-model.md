# ADR-042 Progressive Autonomy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Agents at different maturity levels need different autonomy permissions. Newly onboarded agents should progressively earn trust.

## Decision

### Autonomy Levels

| Level | Name | Permissions |
|------|------|-------------|
| 0 | supervised | Full human supervision |
| 1 | assisted | Assisted suggestions |
| 2 | partial_auto | Partial automation |
| 3 | high_auto | High automation |
| 4 | full_auto | Full automation |
| 5 | autonomous | Autonomous decision-making (only available in high-maturity domains) |

Rules:

- `full_auto` does not mean unlimited automation.
- High-risk domains default to cannot enter `full_auto` unless there is explicit `DomainRiskSpec` / `DomainRiskProfile` allowance with human accountability boundaries.
- If a domain is marked as `advisory_only`, `human_accountable`, or `deterministic_hot_path_only`, the maximum autonomy level must be below `full_auto`.

### Promotion Rules

- Based on execution success rate
- Based on risk assessment results
- Based on human feedback
- Progressive promotion, avoiding leapfrogging

### Demotion Rules

- Consecutive failures trigger demotion
- Risk events trigger demotion
- Users can manually demote

### Permission Boundaries

- Each level has clear permission scope
- High-risk operations require higher levels
- Critical decisions retain human approval

## Consequences

Pros:

- Progressive authorization reduces risk
- Incentivizes agents to continuously improve
- Clear permission boundaries facilitate management

Cons:

- Promotion/demotion logic is complex
- Requires comprehensive monitoring and evaluation mechanisms

## Cross References

- [ADR-041 Proactive Agent Framework](./041-proactive-agent-framework.md)
- [ADR-083 Proactive Agent and Progressive Autonomy](./083-proactive-agent-and-progressive-autonomy.md)

## Source Section

- `§42` Progressive Autonomy Model

## v4.3 ADR Remediation

- A-34: This ADR originally wrote level 4 `full_auto` as "full automation". The root cause is that the Progressive Autonomy ADR mistakenly wrote the autonomy levels as an unlimited authorization ladder, without binding to high-risk domain risk override rules. Fix: The body now explicitly states that high-risk domains cannot enter `full_auto` by default unless there is explicit `DomainRiskSpec` / `DomainRiskProfile` allowance.
- R3-54: This ADR defines 6 levels of autonomy (0-5), which do not directly correspond to the 4 levels required by §42.1. The root cause is that the autonomy model evolved from 4 levels to 6 levels. Fix: The body explicitly states that the 6-level system (0 supervised, 1 assisted, 2 partial_auto, 3 high_auto, 4 full_auto, 5 autonomous) is canonical, and §42.1's 4 levels refer to different dimensions (e.g., risk levels), and there is no contradiction between the two.