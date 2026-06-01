# Division Coverage Source of Truth

v3.3 的治理约束统一如下：

- 配置是 `SOT`
- 文档是说明
- 代码是实现
- CI 是裁判

## 权威路径

| 对象 | SOT 路径 |
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

## 枚举约束

- `familyId`: `engineering`, `knowledge-research`, `enterprise-ops`, `gtm-content`, `creative-production`, `regulated`
- `status`: `untracked`, `coverage_draft`, `pilot_ready`, `pilot_active`, `production_candidate`, `production_ready`, `deprecated`, `archived`
- `riskLevel`: `low`, `medium`, `high`, `critical`
- `autonomyBoundary`: `read_only`, `draft_only`, `hitl_required`, `prepared_action_only`, `no_autonomous_high_impact_action`
- `tool risk`: `R0` 到 `R5`

## 发布约束

- 文档不得单独声明 `production_ready` 或 `industry-leading`。
- 任何正式 claim 必须经过 claim gate。
- UI 只能展示 SOT 或 generated report，不得本地伪造结论。
