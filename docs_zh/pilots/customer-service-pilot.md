# Customer Service Pilot

## Workflow

`customer message -> intent -> policy lookup -> tool planning -> action draft -> HITL -> response -> handoff/escalation`

## Safety rules

- refund / write action 无 HITL 必须失败
- handoff / escalation 必须有 receipt
- malicious customer text 不能直接驱动 tool write

## Evidence

- `eval/divisions/customer-service/eval-suite.yaml`
- `redteam/divisions/customer-service/redteam-suite.yaml`
- `docs_zh/divisions/customer-service/leadership-evidence/*`
