# Security Onboarding and Offboarding Process

This document defines the access lifecycle for personnel, service accounts, and automated credentials, covering onboarding authorization, permission changes, offboarding revocation, and audit evidence retention.

## Onboarding

- The direct supervisor submits an access request, specifying the role, business scope, required environment, and validity period.
- Production permissions are denied by default; the operating scenario must be explained and an approver must be bound.
- Initial permissions are granted following the principle of least privilege, with preference for groups and roles; direct binding of long-term privileges to individuals is not allowed.
- All secrets are injected via an approved secret manager or deployment environment; writing to `.env`, script parameters, logs, or fixtures is prohibited.

## Permission Changes

- Permission upgrades must document the reason, time limit, and rollback plan.
- Temporary permissions are automatically revoked upon expiration; when automatic revocation is not possible, a calendar reminder and audit record must be established.
- Cross-team access requires dual confirmation from the resource owner and security owner.

## Offboarding and Transfers

- On the last day of employment, revoke SSO, VPN, code repository, CI/CD, cloud account, database, and observability backend access.
- Rotate personal shared tokens, bot tokens, and long-term API keys that the individual had access to.
- Review the audit logs for the past 30 days to confirm no abnormal exports, privilege escalations, or bursts of failed logins.

## Evidence

- Access request forms.
- Approval records.
- Permission change diffs.
- Secret rotation records.
- Offboarding revocation checklist.
