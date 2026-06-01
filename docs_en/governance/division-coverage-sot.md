# Division Coverage Source of Truth

The governance constraints for v3.3 are unified as follows:

- Configuration is `SOT`
- Documentation is explanation
- Code is implementation
- CI is the referee

## Authoritative Paths

| Object | SOT Path |
| --- | --- |
| familyId | `config/division-coverage/families/*.yaml` |
| divisionId | `config/quality/division-catalog.json` + `divisions/*/division.yaml` |
| alias | `config/division-coverage/aliases.yaml` |
| inventory | `config/division-coverage/inventory/division-inventory.generated.json` |
| coverage card | `config/division-coverage/divisions/*.yaml` |
| scenario | `config/division-coverage/scenarios/*.yaml` |
| tool risk | `config/tool-risk/taxonomy.yaml` + `config/tool-risk/tool-action-descriptors/*.yaml` |
| eval dataset card | `eval/datasets/*/dataset-card.json` |
| eval suite | `eval/divisions/*/eval-suite.yaml` |
| red-team suite | `redteam/divisions/*/redteam-suite.yaml` |
| training policy | `training-data-policy/divisions/*.yaml` |
| revocation policy | `training-data-policy/revocation.yaml` |
| ROI protocol | `roi/measurement-protocol.md` |
| ROI config | `roi/divisions/*.yaml` |
| leadership claim | `config/division-coverage/claims/records.yaml` |

## Enumeration Constraints

- `familyId`: `engineering`, `knowledge-research`, `enterprise-ops`, `gtm-content`, `creative-production`, `regulated`
- `status`: `untracked`, `coverage_draft`, `pilot_ready`, `pilot_active`, `production_candidate`, `production_ready`, `deprecated`, `archived`
- `riskLevel`: `low`, `medium`, `high`, `critical`
- `autonomyBoundary`: `read_only`, `draft_only`, `hitl_required`, `prepared_action_only`, `no_autonomous_high_impact_action`
- `tool risk`: `R0` to `R5`

## Release Constraints

- Documentation alone must not declare `production_ready` or `industry-leading`.
- Any formal claim must pass through the claim gate.
- UI may only display SOT or generated reports, and must not fabricate conclusions locally.