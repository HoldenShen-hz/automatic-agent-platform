# Division Catalog

This directory is used to consolidate the easily confused division families, avoiding the misinterpretation of "similar names" as "identical responsibilities".

## Quality Family

| division | Role | Description |
| --- | --- | --- |
| `quality-assurance` | canonical | Complete regression, defect attribution, and quality certification before production release |
| `qa` | legacy alias | Only used for lightweight smoke validation / rapid regression triage; does not undertake release certification |

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

## Maintenance Rules

- Before adding divisions with similar names, a family map must first be added.
- Alias divisions must explicitly narrow their scope in descriptions, workflows, and schemas, and must not create synonymous duplication with canonical divisions.
