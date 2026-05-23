# ADR-084 Operator Dashboard And User Experience

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Unified aggregation of task, incident, cost, approval, autonomy signals
- **Assess**: Generate operator / admin / fleet views and summaries
- **Plan**: Recommend operations based on attention queue
- **Execute**: Trigger approval, takeover, rollback, repair through console
- **Feedback**: User clicks, accepting suggestions, failure review
- **Learn**: View weight and summary prompt optimization
- **Improve**: Dashboard layout, summary quality, and UX process improvement
- **Release**: Console and UX component rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§43-§44` requires the platform to not just provide infrastructure metrics, but to provide:

- L1 operator view
- L2 domain admin view
- L3 platform ops view
- L4 fleet view
- Guided UX for non-technical users

The current repository already has `src/interaction/dashboard` and `src/interaction/ux`, but the latter is mostly still an empty shell.

## Decisions

### 1. Dashboard is layered by role, not by page

Dashboard canonical layers are fixed as:

- Operator Dashboard
- Domain Admin Dashboard
- Platform Ops Dashboard
- Fleet Dashboard

### 2. Attention Queue is the unified entry for all console actions

All objects requiring human intervention are uniformly mapped to `AttentionItem`, rather than each module having its own UI event model.

### 3. Non-technical UX uses wizard / template / summary trio

For non-technical users, prioritize exposing:

- onboarding wizard
- template engine
- NL summary

Do not directly expose complex runtime terminology.

### 4. Console is the surface layer for governance actions, does not承载 governance logic

Real governance logic still belongs to control-plane / org-governance / ops-maturity.

## Consequences

- `src/interaction/dashboard` needs to become UI aggregation layer rather than business logic dump
- When `src/interaction/ux` supplement implementation later, it must revolve around canonical role layers
