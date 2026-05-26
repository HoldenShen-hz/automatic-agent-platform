# ADR-042 Progressive Autonomy Model

- Status: Accepted
- Decision Date: 2026-04-20

## Context

Agents at different maturity levels require different autonomy permissions. Newly onboarded agents should progressively earn trust.

## Decision

### Autonomy Levels

| Level | Name | Permissions |
|-------|------|-------------|
| L1 | suggestion | Only generates suggestions, does not auto-execute |
| L2 | supervised | Allows controlled execution with human confirmation or strict oversight |
| L3 | semi_auto | Allows low-risk auto-execution, high-risk still requires escalation |
| L4 | full_auto | Allows auto-execution within explicit boundaries |

The interaction autonomy enum must retain `suggestion` and `frozen` at both ends: `suggestion` means only providing suggestions without auto-execution; `frozen` means interaction progression is frozen due to risk, panic, or governance policy. This enum only describes interaction autonomy, and is not equivalent to `UnifiedRuntimeMode`.

Rules:

- `full_auto` does not mean unlimited automation.
- High-risk domains default to not entering `full_auto` unless there is explicit `DomainRiskSpec` / `DomainRiskProfile` allowance with human accountability boundaries.
- If a domain is marked as `advisory_only`, `human_accountable`, or `deterministic_hot_path_only`, the autonomy level ceiling must be below `full_auto`.

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
- High-risk operations require higher level
- Key decisions retain human approval

## Consequences

Pros:

- Progressive authorization reduces risk
- Incentivizes continuous agent improvement
- Clear permission boundaries facilitate management

Cons:

- Promotion/demotion logic is complex
- Requires comprehensive monitoring and evaluation mechanisms

## Cross References

- [ADR-041 Proactive Agent Framework](./041-proactive-agent-framework.md)
- [ADR-083 Proactive Agent and Progressive Autonomy](./083-proactive-agent-and-progressive-autonomy.md)

## Source Sections

- `§42` Progressive Autonomy Model

## v4.3 ADR Remediation

- A-34: This ADR originally wrote level 4 `full_auto` as "complete automation", root cause being the progressive autonomy ADR mistakenly wrote the autonomy levels as an unlimited authorization ladder without binding to high-risk domain risk override rules. Fix: The main text now explicitly states that high-risk domains default to not `full_auto` unless there is explicit `DomainRiskSpec` / `DomainRiskProfile` allowance.
- R3-54: This ADR previously retained both a 6-level autonomy experimental naming and the §42.1 4-level external delivery model, causing contract vs. product expression conflicts. Fix: The main text now unifies to `suggestion / supervised / semi_auto / full_auto` four-level interaction autonomy; finer-grained runtime constraints continue to be carried by `RuntimeModeEnvelope`.