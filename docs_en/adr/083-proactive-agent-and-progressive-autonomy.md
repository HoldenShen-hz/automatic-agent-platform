# ADR-083 Proactive Agent And Progressive Autonomy

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Events, thresholds, timers, and external signal listening
- **Assess**: Trigger condition evaluation, trust score, and risk gate
- **Plan**: Triggered action selection, suggestion mode or automatic mode decision
- **Execute**: Proactively trigger tasks, suggestions, dashboard updates
- **Feedback**: Proactive suggestion acceptance rate, false positive rate, failure rate
- **Learn**: Continuous calibration of triggers and autonomy levels
- **Improve**: Autonomy promotion / demotion strategy optimization
- **Release**: Canary release of proactive capabilities and autonomy rules

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

Proactive behavior must go through explicit trigger declaration, at minimum containing:

- trigger source
- trigger condition
- rate limit
- cooldown
- action template
- risk level

### 2. Autonomy is Not a Boolean Switch, But a Level State Machine

Autonomy must distinguish at minimum:

- `manual_only`
- `suggest_only`
- `supervised_execute`
- `trusted_auto_execute`

Autonomy levels must be promotable, demotable, and freezable.

### 3. Proactive Triggering and Autonomy Level are Decoupled

Whether to trigger is determined by the trigger;
After triggering, whether to "suggest / human review / auto-execute" is determined by the autonomy level.

### 4. Autonomy Level Changes Must Be Auditable

Each autonomy level change must record:

- old level
- new level
- reason codes
- evidence snapshot
- approver / policy source

## Consequences

- Proactive capabilities will not bypass approval, budget, and risk engine
- Autonomy upgrade is no longer a static configuration, but a continuous governance issue
- `src/interaction/proactive-agent` and `src/interaction/autonomy` will share a unified contract
