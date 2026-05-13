# ADR-084: Operator Dashboard And User Experience

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Unified aggregation of task, incident, cost, approval, and autonomy signals
- **Assess**: Generate operator / admin / fleet views and summaries
- **Plan**: Recommend actions based on attention queue
- **Execute**: Trigger approval, takeover, rollback, and repair through console
- **Feedback**: User clicks, suggestion acceptance, failure post-mortem
- **Learn**: View weight and summary hint optimization
- **Improve**: Dashboard layout, summary quality, and UX flow improvement
- **Release**: Console and UX component staged rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§43-§44` requires the platform to provide not just infrastructure metrics, but:

- L1 operator view
- L2 domain admin view
- L3 platform ops view
- L4 fleet view
- Guided UX for non-technical users

The current repository has `src/interaction/dashboard` and `src/interaction/ux`, but the latter is mostly empty shells.

## Decision

### 1. Dashboards are layered by role, not by page

Dashboard canonical layers are fixed as:

- Operator Dashboard
- Domain Admin Dashboard
- Platform Ops Dashboard
- Fleet Dashboard

### 2. Attention Queue is the unified entry point for all console actions

All objects requiring human intervention are uniformly mapped to `AttentionItem`, rather than each module having its own UI event model.

### 3. Non-technical UX uses wizard / template / summary trio

For non-technical users, preferentially expose:

- onboarding wizard
- template engine
- NL summary

Do not directly expose complex runtime terminology.

### 4. Console is the surface layer for executing governance actions, not carrying governance logic

The real governance logic still belongs to control-plane / org-governance / ops-maturity.

## Consequences

- `src/interaction/dashboard` needs to become a UI aggregation layer, not a business logic dumping point
- When subsequent implementation supplements `src/interaction/ux`, it must expand around canonical role layers