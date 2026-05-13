# ADR-083: Proactive Agent And Progressive Autonomy

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Event, threshold, timer, and external signal monitoring
- **Assess**: Trigger condition evaluation, trust score, and risk gate
- **Plan**: Trigger action selection, suggestion mode, or auto mode decision
- **Execute**: Proactively trigger tasks, suggestions, dashboard updates
- **Feedback**: Proactive suggestion acceptance rate, false positive rate, failure rate
- **Learn**: Continuous calibration of triggers and autonomy levels
- **Improve**: Autonomy promotion / demotion strategy optimization
- **Release**: Proactive capability and autonomy rule staged rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§41-§42` requires the platform to support proactive agents and progressive autonomy. The current repository has:

- `src/interaction/proactive-agent`
- `src/interaction/autonomy`

But the two have not yet been connected by a unified decision.

## Decision

### 1. Proactive agents can only work through declarative TriggerDefinition

Proactive behavior must go through explicit trigger declaration, containing at minimum:

- trigger source
- trigger condition
- rate limit
- cooldown
- action template
- risk level

### 2. Autonomy is not a boolean switch, but a level state machine

Autonomy adopts the 6-level hierarchical naming system defined in ADR-042 (consistent with ADR-042):

| Level | Name | Description |
|------|------|------|
| **0** | `supervised` | Full human supervision |
| **1** | `assisted` | Assisted suggestions |
| **2** | `partial_auto` | Partial automation |
| **3** | `high_auto` | High automation |
| **4** | `full_auto` | Full automation (requires DomainRiskSpec allowance in high-risk domains) |
| **5** | `autonomous` | Autonomous decision (only available in high-maturity domains) |

Constraints:
- High-risk domains default to not entering `full_auto` unless explicit `DomainRiskSpec` / `DomainRiskProfile` allowance exists with human accountability boundaries
- Any level can be manually demoted or frozen
- Level promotion must go through evaluation period verification

### 3. Proactive triggers and autonomy levels are decoupled

Whether to trigger is determined by the trigger;
After triggering, whether to take "suggestion / human review / auto execution" is determined by the autonomy level.

### 4. Autonomy level changes must be auditable

Each autonomy level change must record:

- old level
- new level
- reason codes
- evidence snapshot
- approver / policy source

## Consequences

- Proactive capabilities do not bypass approval, budget, and risk engines
- Autonomy upgrade is no longer a static configuration, but a continuous governance issue
- `src/interaction/proactive-agent` and `src/interaction/autonomy` will share a unified contract

## v4.3 ADR Remediation

- R3-55: This ADR originally defined a third autonomy naming system, incompatible with ADR-042's 6-level system. Root cause: Proactive Agent ADR was drafted independently without alignment with Progressive Autonomy ADR. Fix: The text now explicitly declares adoption of the 6-level hierarchical naming system (0-5) defined in ADR-042, keeping the two consistent.