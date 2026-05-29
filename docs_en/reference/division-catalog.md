# Division Catalog

This directory is used to consolidate the easily confused division families, avoiding the misinterpretation of "similar names" as "identical responsibilities".

## Quality Family

| division | Role | Description |
| --- | --- | --- |
| `quality-assurance` | canonical | Complete regression, defect attribution, and quality certification before production release |
| `qa` | legacy alias | Only used for lightweight smoke validation / rapid regression triage; does not undertake release certification |

Note: `qa` and `quality-assurance` intentionally use different `default_workflow` values. The former is a smoke alias, while the latter is the canonical release-certification division.

## Operations Family

| division | Role | Description |
| --- | --- | --- |
| `engineering_ops` | build/release delivery | Engineering delivery, pipelines, build and release coordination |
| `general_ops` | generic operator fallback | Generic fallback execution surface, suitable for low-specificity tasks |
| `operations` | service operations | Service operation, monitoring, daily operations |
| `it-operations` | workstation / identity ops | Endpoint, account, device and identity domain operations |

## Machine-Verifiable Sources

- `config/quality/division-catalog.json`
- `scripts/ci/audit-division-workflows.mjs`

## Field Mapping

| config/quality/division-catalog.json | Meaning |
| --- | --- |
| `divisionId` | Canonical ID used by the directory and `division.yaml` |
| `family` | Governance grouping; not the same thing as an alias |
| `scope` | The division's bounded responsibility inside the family |
| `canonicalDivisionId` | Only used for explicit aliases, for example `qa -> quality-assurance` |

## Maintenance Rules

- Before adding divisions with similar names, a family map must first be added.
- Alias divisions must explicitly narrow their scope in descriptions, workflows, and schemas, and must not create synonymous duplication with canonical divisions.
