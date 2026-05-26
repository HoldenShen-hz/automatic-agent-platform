# Governance

---

## OAPEFLIR Association

This governance document standardizes the following content within the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection and governance boundaries
- **Assess**: Execution assessment and permission governance
- **Plan**: Planning constraints and R3 hard constraints
- **Execute**: Execution permissions and security boundaries
- **Feedback**: Feedback signal governance and classification
- **Learn**: Learning content validation and promotion boundaries
- **Improve**: Improvement candidate approval and Rollout governance
- **Release**: Release permissions and automatic rollback rules

---

> `governance/` records cross-document, cross-module, and cross-team governance rules.

## Current Files

- [source_of_truth.md](./source_of_truth.md)
- [change_control.md](./change_control.md)
- [naming_and_directory_conventions.md](./naming_and_directory_conventions.md)
- [glossary_and_terminology.md](./glossary_and_terminology.md)
- [autonomy_boundary_policy.md](./autonomy_boundary_policy.md) — AI autonomy permission boundaries (L0-L5)
- [rollout_release_policy.md](./rollout_release_policy.md) — Controlled release and rollback policies

## Purpose

- Define source of truth rules.
- Define document update and conflict resolution rules.
- Define cross-module boundaries, terminology, directory, and change governance.
- Define unified naming conventions for canonical IDs, business aliases, and naming formats.
- Define unified meanings for high-frequency terminology across core objects, states, events, governance, security, storage, and operations.

## Writing Rules

- Governance is a long-term rules layer; do not write temporary execution matters.
- If a governance rule affects platform behavior, link to the corresponding ADR or contract.
- Keep only one master copy of each rule to avoid multiple forks.
