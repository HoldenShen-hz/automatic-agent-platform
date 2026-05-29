# Governance

---

## OAPEFLIR Relevance

This governance document regulates the following aspects of the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection vs governance boundary
- **Assess**: Execution evaluation vs permission governance
- **Plan**: Planning constraints vs R3 hard constraints
- **Execute**: Execution permissions vs security boundary
- **Feedback**: Feedback signal governance vs classification
- **Learn**: Learning content validation vs promotion boundary
- **Improve**: Improvement candidate approval vs Rollout governance
- **Release**: Release permissions vs auto-rollback rules

---

> `governance/` records cross-document, cross-module, cross-team governance rules.

## Current Files

- [source_of_truth.md](./source_of_truth.md)
- [change_control.md](./change_control.md)
- [naming_and_directory_conventions.md](./naming_and_directory_conventions.md)
- [glossary_and_terminology.md](./glossary_and_terminology.md)
- [autonomy_boundary_policy.md](./autonomy_boundary_policy.md) — AI autonomy permission boundaries (L0-L5)
- [rollout_release_policy.md](./rollout_release_policy.md) — Controlled release and rollback policy

## Purpose

- Defines source of truth rules.
- Defines document update and conflict handling rules.
- Defines cross-module boundaries, terminology, directory, and change governance approach.
- Defines unified writing for canonical ids, business aliases, and naming formats.
- Defines unified meaning of core objects, statuses, events, governance, security, storage, operations, and other high-frequency technical terms.

## Writing Rules

- Governance is the long-term rules layer; do not write temporary execution items.
- If a governance rule affects platform behavior, link to the corresponding ADR or contract.
- Keep only one master version of each rule to avoid multiple divergent copies.
