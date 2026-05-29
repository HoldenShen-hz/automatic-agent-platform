# ADR-042 Progressive Autonomy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Background

Agents of different maturity levels need different autonomy permissions, and newly onboarded agents should gradually earn trust.

## Decision

### Autonomy Levels

| Level | Name | Permissions |
|-------|------|-------------|
| L1 | suggestion | Only generates suggestions, does not execute automatically |
| L2 | supervised | Allows controlled execution, but requires human confirmation or strong supervision |
| L3 | semi_auto | Allows low-risk automatic execution, high-risk still requires escalation |
| L4 | full_auto | Allows automatic execution within explicit boundaries |

The interaction autonomy enum needs to retain `suggestion` and `frozen` at both ends: `suggestion` indicates only giving recommendations, not automatically executing; `frozen` indicates freezing interaction advancement due to risk, panic, or governance policy. This enum only describes interaction autonomy and is not equivalent to `UnifiedRuntimeMode`.

Rules:

- `full_auto` does not mean unrestricted automation.
- High-risk domains default to cannot enter `full_auto` unless there is explicit `DomainRiskSpec` / `DomainRiskProfile` allowance with attached human accountability boundaries.
- If a domain is marked as `advisory_only`, `human_accountable`, or `deterministic_hot_path_only`, then the autonomy level ceiling must be lower than `full_auto`.

### Promotion Rules

- Based on execution success rate
- Based on risk assessment results
- Based on human feedback
- Progressive promotion, avoid leaps

### Demotion Rules

- Continuous failures trigger demotion
- Risk events trigger demotion
- Users can manually demote

### Permission Boundaries

- Each level has clear permission scope
- High-risk operations require high level
- Key decisions retain human approval

## Consequences

Advantages:

- Progressive authorization reduces risk
- Incentivizes agents to continuously improve
- Clear permission boundaries facilitate management

Trade-offs:

- Promotion/demotion logic is complex
- Requires robust monitoring and evaluation mechanisms

## Cross References

- [ADR-041 Proactive Agent Framework](./041-proactive-agent-framework.md)
- [ADR-083 Proactive Agent and Progressive Autonomy](./083-proactive-agent-and-progressive-autonomy.md)

## Source Section

- `§42` Progressive Autonomy Model

## v4.3 ADR Remediation

- A-34: This ADR originally wrote level 4 `full_auto` as "full automation", root cause being the progressive autonomy ADR incorrectly wrote the autonomy level as an unlimited ladder, not binding to high-risk domain risk override rules. Fix: Body now explicitly states high-risk domains default cannot enter `full_auto` unless there is explicit `DomainRiskSpec / DomainRiskProfile` allowance.
- R3-54: This ADR previously retained both 6-level autonomy experimental naming and §42.1's 4-level external delivery model, causing contract vs product expression conflict. Fix: Body now unified to `suggestion / supervised / semi_auto / full_auto` four-level interaction autonomy; finer-grained runtime limits continue to be carried by `RuntimeModeEnvelope`.