# Governance

---

## OAPEFLIR Association

This governance document governs the following content in the OAPEFLIR eight-stage cognitive cycle:

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
- [rollout_release_policy.md](./rollout_release_policy.md) — Controlled release and rollback strategy
- [terminology-bilingual.md](./terminology-bilingual.md) — Chinese-English terminology reference

## Purpose

- Define source of truth rules.
- Define document update and conflict resolution rules.
- Define cross-module boundaries, terminology, directory, and change governance approaches.
- Define unified conventions for canonical IDs, business aliases, and naming formats.
- Define unified meanings for high-frequency technical terms in core objects, states, events, governance, security, storage, and operations.

## Writing Rules

- Governance is a long-term rules layer; do not write temporary execution matters.
- If a governance rule affects platform behavior, link to the corresponding ADR or contract.
- Each rule should have only one master version to avoid multiple forks.