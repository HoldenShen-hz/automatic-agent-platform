# ADR-084 Operator Dashboard And User Experience

---

## OAPEFLIR Association

This document defines the following components in the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Unified aggregation of task, incident, cost, approval, and autonomy signals
- **Assess**: Generate operator / admin / fleet views and summaries
- **Plan**: Recommend operations based on attention queue
- **Execute**: Trigger approval, takeover, rollback, and repair through console
- **Feedback**: User clicks, accepted suggestions, failure review
- **Learn**: View weight and summary prompt optimization
- **Improve**: Dashboard layout, summary quality, and UX flow improvement
- **Release**: Canary release of console and UX components

---

- Status: Accepted
- Decision Date: 2026-04-20

## Context

v2.7 `§43-§44` requires the platform to provide not just infrastructure metrics, but:

- L1 Operator view
- L2 Domain admin view
- L3 Platform operations view
- L4 Fleet view
- Guided UX for non-technical users

The current repository already has `src/interaction/dashboard` and `src/interaction/ux`, but the latter is mostly still an empty shell.

## Decision

### 1. Dashboard is Layered by Role, Not by Page

The canonical dashboard layers are fixed as:

- Operator Dashboard
- Domain Admin Dashboard
- Platform Ops Dashboard
- Fleet Dashboard

### 2. Attention Queue is the Unified Entry Point for All Console Actions

All objects requiring human intervention are uniformly mapped to `AttentionItem`, rather than each module having its own separate UI event model.

### 3. Non-Technical UX Uses Wizard / Template / Summary Trio

For non-technical users, prioritize exposing:

- onboarding wizard
- template engine
- NL summary

Do not directly expose complex runtime terminology.

### 4. Console is the Surface Layer for Governance Actions, Does Not Carry Governance Logic

The real governance logic still belongs to control-plane / org-governance / ops-maturity.

## Consequences

- `src/interaction/dashboard` needs to become a UI aggregation layer rather than a business logic dumping ground
- When `src/interaction/ux` subsequently adds implementation, it must be built around the canonical role hierarchy
