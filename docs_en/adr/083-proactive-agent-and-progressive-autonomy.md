# ADR-083: Proactive Agent And Progressive Autonomy

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

## Context

v2.7 `§41-§42` requires the platform to support proactive agents and progressive autonomy. The current repository already has:

- `src/interaction/proactive-agent`
- `src/interaction/autonomy`

But they have not yet been connected by a unified decision.

## Decision

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

Autonomy uses the 4-level naming system defined in ADR-042 (aligned with ADR-042):

| Level | Name | Description |
|-------|------|-------------|
| **L1** | `suggestion` | Only generates suggestions |
| **L2** | `supervised` | Execute after human confirmation |
| **L3** | `semi_auto` | Low-risk auto-execute, high-risk escalate |
| **L4** | `full_auto` | Auto-execute within explicit governance boundaries |

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

- R3-55: This ADR originally defined a third set of autonomy naming system, incompatible with ADR-042's system. Root cause was that the proactive agent ADR was drafted independently without alignment with the progressive autonomy ADR. Fix: The text now explicitly declares adoption of ADR-042's `suggestion / supervised / semi_auto / full_auto` four-level system, keeping them consistent.