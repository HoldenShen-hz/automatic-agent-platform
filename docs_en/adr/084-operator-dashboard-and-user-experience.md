# ADR-084 Operator Dashboard And User Experience

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Unified aggregation of task, incident, cost, approval, autonomy signals
- **Assess**: Generate operator / admin / fleet views and summaries
- **Plan**: Recommend operations based on attention queue
- **Execute**: Trigger approval, takeover, rollback, repair through console
- **Feedback**: User clicks, suggestion acceptance, failure review
- **Learn**: View weights and summary hint optimization
- **Improve**: Dashboard layout, summary quality, and UX flow improvement
- **Release**: Console and UX component rollout

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§43-§44` requires the platform to provide not just infrastructure metrics, but also:

- L1 Operator view
- L2 Domain Admin view
- L3 Platform Ops view
- L4 Fleet view
- Guided UX for non-technical users

The current repository already has `src/interaction/dashboard` and `src/interaction/ux`, but the latter is mostly still an empty barrel.

## Decision

### 1. Dashboard Is Layered by Role, Not by Page

Dashboard canonical layers are fixed as:

- Operator Dashboard
- Domain Admin Dashboard
- Platform Ops Dashboard
- Fleet Dashboard

### 2. Attention Queue Is the Unified Entry for All Console Actions

All objects requiring human intervention are uniformly mapped to `AttentionItem`, instead of each module having its own UI event model.

### 3. Non-Technical UX Uses Wizard / Template / Summary Trio

For non-technical users, prioritize exposing:

- onboarding wizard
- template engine
- NL summary

Do not directly expose complex runtime terminology.

### 4. Console Is the Surface Layer for Governance Actions, Does Not Carry Governance Logic

True governance logic still belongs to control-plane / org-governance / ops-maturity.

## Consequences

- `src/interaction/dashboard` needs to become a UI aggregation layer, not a business logic dumping ground
- When `src/interaction/ux` supplements subsequent implementation, it must develop around canonical role layers
