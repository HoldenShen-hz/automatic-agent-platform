# ADR-083 Proactive Agent And Progressive Autonomy

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Event, threshold, timer, and external signal monitoring
- **Assess**: Trigger condition evaluation, trust score, and risk gate
- **Plan**: Trigger action selection, suggestion mode or automatic mode decision
- **Execute**: Proactively trigger tasks, suggestions, kanban updates
- **Feedback**: Proactive suggestion acceptance rate, false positive rate, failure rate
- **Learn**: Continuous calibration of triggers and autonomy levels
- **Improve**: Autonomy promotion / demotion strategy optimization
- **Release**: Proactive capability and autonomy rules canary release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§41-§42` requires the platform to support proactive agents and progressive autonomy. The repository already has:

- `src/interaction/proactive-agent`
- `src/interaction/autonomy`

But they have not yet been tied together by a unified decision.

## Decision

### 1. Proactive Agent Can Only Work Through Declarative TriggerDefinition

Proactive behavior must go through explicit trigger declaration, containing at minimum:

- trigger source
- trigger condition
- rate limit
- cooldown
- action template
- risk level

### 2. Autonomy Is Not a Boolean Switch, But a Level State Machine

Implementation layer must explicitly distinguish `InteractionAutonomyLevel` and `UnifiedRuntimeMode`: the former determines suggestion / human review / automatic interaction boundaries, the latter determines runtime degradation, pause, and `incident_mode`.

Autonomy adopts the 4-level interaction autonomy naming system defined in ADR-042 (consistent with ADR-042):

| Level | Name | Description |
|-------|------|-------------|
| **L1** | `suggestion` | Only generates suggestions |
| **L2** | `supervised` | Execute after human confirmation |
| **L3** | `semi_auto` | Low-risk auto-execute, high-risk escalate |
| **L4** | `full_auto` | Auto-execute within explicit governance boundary |

Constraints:
- High-risk domains default to cannot enter `full_auto` unless explicit `DomainRiskSpec` / `DomainRiskProfile` allows it with human accountability boundary
- Any level can be manually demoted or frozen
- Level promotion must go through evaluation period validation

### 3. Proactive Trigger and Autonomy Level Are Decoupled

Whether to trigger is determined by trigger;
After triggering, "suggestion / human review / automatic execution" is determined by autonomy level.

### 4. Autonomy Level Changes Must Be Auditable

Each autonomy level change must record:

- old level
- new level
- reason codes
- evidence snapshot
- approver / policy source

## Consequences

- Proactive capabilities will not bypass approval, budget, and risk engine
- Autonomy upgrade is no longer static configuration, but continuous governance issue
- `src/interaction/proactive-agent` and `src/interaction/autonomy` will share unified contract

## v4.3 ADR Remediation

- R3-55: This ADR originally defined a third autonomy naming system, incompatible with ADR-042. Fix: Body now explicitly declares adoption of ADR-042's `suggestion / supervised / semi_auto / full_auto` four-level system, keeping them consistent.