# ADR-083 Proactive Agent And Progressive Autonomy

---

## OAPEFLIR Association

This document defines the following components within the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Event, threshold, timer, and external signal monitoring
- **Assess**: Trigger condition evaluation, trust score, and risk gate
- **Plan**: Triggered action selection, suggestion mode or automatic mode decision
- **Execute**: Proactive task triggering, suggestions, kanban updates
- **Feedback**: Proactive suggestion acceptance rate, false positive rate, failure rate
- **Learn**: Continuous calibration of triggers and autonomy levels
- **Improve**: Autonomy promotion / demotion strategy optimization
- **Release**: Proactive capability and autonomy rule canary release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§41-§42` requires the platform to support proactive agents and progressive autonomy. The current repository already contains:

- `src/interaction/proactive-agent`
- `src/interaction/autonomy`

However, the two have not yet been tied together by a unified decision.

## Decision

### 1. Proactive Agents Must Only Work Through Declarative TriggerDefinition

Proactive behavior must go through explicit trigger declaration, at minimum containing:

- trigger source
- trigger condition
- rate limit
- cooldown
- action template
- risk level

### 2. Autonomy Is Not a Boolean Switch, But a Level State Machine

Autonomy adopts the 6-level hierarchical naming system defined in ADR-042 (consistent with ADR-042):

| Level | Name | Description |
|-------|------|-------------|
| **0** | `supervised` | Full human supervision |
| **1** | `assisted` | Assisted suggestions |
| **2** | `partial_auto` | Partial automation |
| **3** | `high_auto` | High automation |
| **4** | `full_auto` | Full automation (high-risk domains require DomainRiskSpec approval) |
| **5** | `autonomous` | Autonomous decision-making (only available in high-maturity domains) |

Constraints:
- High-risk domains shall not enter `full_auto` by default unless there is explicit `DomainRiskSpec` / `DomainRiskProfile` approval with human accountability boundaries
- Any level can be manually demoted or frozen
- Level promotion must pass through an evaluation period

### 3. Proactive Triggers Are Decoupled from Autonomy Levels

Whether to trigger is determined by the trigger;
After triggering, the action taken ("suggestion / human review / automatic execution") is determined by the autonomy level.

### 4. Autonomy Level Changes Must Be Auditable

Every autonomy level change must record:

- old level
- new level
- reason codes
- evidence snapshot
- approver / policy source

## Consequences

- Proactive capabilities will not bypass approval, budget, and risk engines
- Autonomy upgrades are no longer static configuration, but a continuous governance issue
- `src/interaction/proactive-agent` and `src/interaction/autonomy` will share a unified contract

## v4.3 ADR Remediation

- R3-55: This ADR originally defined a third autonomy naming system, incompatible with ADR-042's 6-level system. The root cause was that the proactive agent ADR was drafted independently without alignment with the progressive autonomy ADR. Fix: The document now explicitly states adoption of the 6-level hierarchical naming system defined in ADR-042 (0-5), keeping the two consistent.