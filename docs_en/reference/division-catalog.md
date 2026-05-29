# Division Catalog

This directory maintains the authoritative family map for `divisions/`. It covers both easily confused alias families and the attribution of remaining standalone divisions, avoiding misreading "similar names" as "same responsibilities", and avoiding directory existing but catalog missing.

## Quality Family

| division | Role Definition | Description |
|---|---|-------|
| `quality-assurance` | canonical | Complete regression, defect attribution, and quality certification before production release |
| `qa` | legacy alias | Only used for lightweight smoke validation / fast regression triage, does not bear release certification |

Description: `qa` and `quality-assurance` intentionally use different `default_workflow`. The former is a smoke alias, the latter is the release certification canonical division; they cannot be treated as synonymous directories.

## Operations Family

| division | Role Definition | Description |
|---|---|-------|
| `engineering_ops` | build/release delivery | Engineering delivery, pipelines, build and release coordination |
| `general_ops` | generic operator fallback | Generic fallback execution plane, suitable for low-specificity tasks |
| `operations` | service operations | Service operations, on-call, daily operations |
| `it-operations` | workstation / identity ops | Endpoint, account, device and identity domain operations |

## Machine-Verifiable Sources

- `config/quality/division-catalog.json`
- `scripts/ci/audit-division-workflows.mjs`

## Machine Field Reference

| config/quality/division-catalog.json | Document Meaning |
| --- | --- |
| `divisionId` | Division directory and canonical ID of `division.yaml` |
| `family` | Governance grouping, not equivalent to directory alias |
| `scope` | The scope of this division within the family |
| `canonicalDivisionId` | Only used for explicit alias, e.g., `qa -> quality-assurance` |

## Current Coverage Principle

- Active divisions in `divisions/` directory must be registered in the catalog.
- Only explicit aliases like `qa -> quality-assurance` use `canonicalDivisionId`.
- Other divisions must declare at least `family` and `scope` for governance and audit grouping.

## Non-Goals

- This document is not a plugin capability registry.
- The authoritative source for plugin `domainIds` / `capabilityIds` is in `src/plugins/builtin-plugin-registry.ts` and corresponding runtime plugin definitions.
- `divisions/` is responsible for routing, roles, workflow, and risk boundaries, not for maintaining plugin capability enumeration.

## Priority Description

- `priority` in `division.yaml` is a coarse-grained routing weight, not required to be globally unique.
- Same-tier parallelism is allowed; real routing still needs to combine trigger match length, explicit disambiguation rules, and stable sorting.
- When adding a new division, first determine if a new priority bandwidth is needed; if it is just a parallel candidate within the same class of capabilities, the existing tier can be reused.

## Priority Tiers

| priority | Semantics |
| --- | --- |
| `20` | Generic operations/on-call fallback |
| `30` | Lightweight analysis / smoke / low-intrusion content class tasks |
| `35` | Research / design class medium-low priority entry |
| `40` | General project / data / product execution |
| `45` | High-frequency business execution plane |
| `50` | Engineering delivery main line |
| `55` | IT operations exclusive entry |
| `60` | High-risk strong governance domain |

## Workflow / Blueprint Semantics

- `default_plan_blueprint_ref` / `orchestration_plan_blueprint_ref` are the current semantic authority fields, used to distinguish "default single-task plan" from "multi-step orchestration plan".
- `default_workflow` / `orchestration_workflow` are retained only for legacy loader; for single workflow divisions, both can temporarily point to the same workflow id.
- When adding or completing division definitions, should prioritize adding blueprint ref, rather than continuing to stuff semantics into legacy workflow alias.

## Maintenance Rules

- Before adding a division with similar name, must first supplement the family map.
- Alias divisions must explicitly narrow the scope in description, workflow, and schema, and cannot form synonymous duplication with canonical division.