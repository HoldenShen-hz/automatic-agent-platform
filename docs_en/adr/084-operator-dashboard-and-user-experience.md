# ADR-084 Operator Dashboard And User Experience

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Unified aggregation of task, incident, cost, approval, autonomy signals
- **Assess**: Generate operator / admin / fleet views and summaries
- **Plan**: Recommend operations based on attention queue
- **Execute**: Trigger approval, takeover, rollback, repair through console
- **Feedback**: User clicks, accept suggestions, failure review
- **Learn**: View weighting and summary prompt optimization
- **Improve**: Dashboard layout, summary quality, and UX flow improvement
- **Release**: Console and UX component canary release

---

- Status: Accepted
- Decision Date: 2026-04-20

## Background

v2.7 `§43-§44` requires the platform to provide not just infrastructure metrics, but also:

- L1 operator view
- L2 domain admin view
- L3 platform ops view
- L4 fleet view
- Guided UX for non-technical users

The repository already has `src/interaction/dashboard` and `src/interaction/ux`, but the latter is mostly still an empty shell.

## Decision

### 1. Dashboard Is Layered by Role, Not by Page

Dashboard canonical layers are fixed as:

- Operator Dashboard
- Domain Admin Dashboard
- Platform Ops Dashboard
- Fleet Dashboard

### 2. Attention Queue Is the Unified Entry Point for All Console Actions

All objects requiring human intervention are uniformly mapped to `AttentionItem`, rather than each module having its own separate UI event model.

### 3. Non-Technical UX Uses Wizard / Template / Summary Trio

For non-technical users, prioritize exposing:

- onboarding wizard
- template engine
- NL summary

Do not directly expose complex runtime terminology.

### 4. Console Is the Surface Layer for Executing Governance Actions, Does Not Carry Governance Logic

True governance logic still belongs to control-plane / org-governance / ops-maturity.

## Consequences

- `src/interaction/dashboard` needs to become a UI aggregation layer, not a business logic dumping ground
- When `src/interaction/ux` supplements implementation later, it must展开 around canonical role layers