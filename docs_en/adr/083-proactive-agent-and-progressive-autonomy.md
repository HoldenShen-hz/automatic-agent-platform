# ADR-083 Proactive Agent And Progressive Autonomy

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Event, threshold, timer, and external signal listening
- **Assess**: Trigger condition evaluation, trust score, and risk gate
- **Plan**: Trigger action selection, suggestion mode or automatic mode decision
- **Execute**: Proactively trigger tasks, suggestions, dashboard updates
- **Feedback**: Proactive suggestion acceptance rate, false positive rate, failure rate
- **Learn**: Continuous calibration of triggers and autonomy levels
- **Improve**: Autonomy promotion / demotion strategy optimization
- **Release**: Proactive capability and autonomy rules rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§41-§42` requires the platform to support proactive agents and progressive autonomy. The repository already has:

- `src/interaction/proactive-agent`
- `src/interaction/autonomy`

But the two have not yet been connected by a unified decision.

## Decisions

### 1. Proactive Agent can only work through declarative TriggerDefinition

Proactive behavior must go through explicit trigger declaration, at minimum containing:

- trigger source
- trigger condition
- rate limit
- cooldown
- action template
- risk level

### 2. Autonomy is not a boolean switch, but a level state machine

Implementation layer must explicitly distinguish `InteractionAutonomyLevel` from `UnifiedRuntimeMode`: the former determines suggestion / human review / automatic interaction boundary, the latter determines runtime degradation, pause, and `incident_mode`.

Autonomy adopts the 4-level interaction autonomy naming system defined in ADR-042 (consistent with ADR-042):

| Level | Name | Description |
|------|------|------|
| **L1** | `suggestion` | Generate suggestions only |
| **L2** | `supervised` | Execute after human confirmation |
| **L3** | `semi_auto` | Low-risk automatic execution, high-risk escalation |
| **L4** | `full_auto` | Automatic execution within explicit governance boundary |

Constraints:
- High-risk domains default to not entering `full_auto` unless explicit `DomainRiskSpec` / `DomainRiskProfile` allows it and includes human accountability boundary
- Any level can be manually demoted or frozen
- Level promotion must pass an evaluation period

### 3. Proactive trigger and autonomy level are decoupled

Whether to trigger is determined by trigger;
After triggering, whether to take "suggestion / human review / automatic execution" is determined by autonomy level.

### 4. Autonomy level changes must be auditable

Each autonomy level change must record:

- old level
- new level
- reason codes
- evidence snapshot
- approver / policy source

## Consequences

- Proactive capabilities will not bypass approval, budget, and risk engine
- Autonomy upgrade is no longer a static configuration, but a continuous governance issue
- `src/interaction/proactive-agent` and `src/interaction/autonomy` will share unified contracts

## v4.3 ADR Remediation

- R3-55: This ADR originally defined a third set of autonomy naming system, incompatible with ADR-042. Fix: The text now explicitly declares adoption of ADR-042's `suggestion / supervised / semi_auto / full_auto` four-level system, keeping the two consistent.
