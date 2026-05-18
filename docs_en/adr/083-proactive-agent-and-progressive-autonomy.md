# ADR-083 Proactive Agent And Progressive Autonomy

---

## OAPEFLIR Relationship

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Event, threshold, timer, and external signal monitoring
- **Assess**: Trigger condition evaluation, trust score, and risk gate
- **Plan**: Trigger action selection, suggestion mode, or automatic mode decision
- **Execute**: Proactively trigger tasks, suggestions, dashboard updates
- **Feedback**: Proactive suggestion acceptance rate, false positive rate, failure rate
- **Learn**: Continuous calibration of triggers and autonomy levels
- **Improve**: Autonomy promotion / demotion strategy optimization
- **Release**: Proactive capability and autonomy rules staged rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§41-§42` requires the platform to support proactive agents and progressive autonomy. The current repository already has:

- `src/interaction/proactive-agent`
- `src/interaction/autonomy`

But they have not yet been connected by a unified decision.

## Decisions

### 1. Proactive Agent Can Only Work Through Declarative TriggerDefinition

Proactive behavior must go through explicit trigger declaration, minimum includes:

- trigger source
- trigger condition
- rate limit
- cooldown
- action template
- risk level

### 2. Autonomy is Not a Boolean Switch, But a Level State Machine

Implementation layer must explicitly distinguish `InteractionAutonomyLevel` and `UnifiedRuntimeMode`: the former determines suggestion/human-review/automatic interaction boundaries, the latter determines runtime degradation, pause, and `incident_mode`.

Autonomy uses the 6-tier naming system defined in ADR-042 (aligned with ADR-042):

| Level | Name | Description |
|-------|------|-------------|
| **0** | `supervised` | Full human supervision |
| **1** | `assisted` | Assisted suggestions |
| **2** | `partial_auto` | Partial automation |
| **3** | `high_auto` | High automation |
| **4** | `full_auto` | Full automation (requires DomainRiskSpec approval in high-risk domains) |
| **5** | `autonomous` | Autonomous decision-making (only available in high-maturity domains) |

Constraints:
- High-risk domains cannot enter `full_auto` by default unless explicit `DomainRiskSpec` / `DomainRiskProfile` approval exists with human accountability boundaries
- Any level can be manually demoted or frozen
- Level promotion must go through evaluation period validation

### 3. Proactive Trigger and Autonomy Level are Decoupled

Whether to trigger is determined by the trigger;
After triggering, whether to take "suggestion / human review / automatic execution" is determined by the autonomy level.

### 4. Autonomy Level Changes Must Be Auditable

Each autonomy level change must record:

- old level
- new level
- reason codes
- evidence snapshot
- approver / policy source

## Consequences

- Proactive capabilities will not bypass approval, budget, and risk engines
- Autonomy upgrade is no longer a static configuration, but a continuous governance issue
- `src/interaction/proactive-agent` and `src/interaction/autonomy` will share a unified contract

## v4.3 ADR Remediation

- R3-55: This ADR originally defined a third set of autonomy naming system, incompatible with ADR-042's 6-tier system. The root cause was that the proactive agent ADR was drafted independently without alignment with the progressive autonomy ADR. Fix: The main text now explicitly declares adoption of ADR-042's 6-tier naming system (0-5), keeping them consistent.
