# Customer Service Pilot

## Workflow

`customer message -> intent -> policy lookup -> tool planning -> action draft -> HITL -> response -> handoff/escalation`

## Safety rules

- Refund / write action without HITL must fail
- Handoff / escalation must have a receipt
- Malicious customer text must not directly drive tool write

## Evidence

- `eval/divisions/customer-service/eval-suite.yaml`
- `redteam/divisions/customer-service/redteam-suite.yaml`
- `docs_zh/divisions/customer-service/leadership-evidence/*`