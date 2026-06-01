# Engineering Pilot

## Workflow

`Issue / CI failure -> repo map -> fault localization -> plan -> patch -> targeted tests -> patch gate -> PR draft`

## Gate

- patch apply check
- targeted tests
- P2P preservation subset
- unsafe file path check
- secret diff scan
- generated command check

## Evidence

- `eval/divisions/coding/eval-suite.yaml`
- `redteam/divisions/coding/redteam-suite.yaml`
- `docs_zh/divisions/coding/leadership-evidence/*`
