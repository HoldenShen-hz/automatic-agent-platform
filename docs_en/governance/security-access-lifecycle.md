# Security Access Lifecycle

This document defines the access lifecycle for personnel, service accounts, and automated credentials, covering onboarding authorization, permission changes, offboarding revocation, and audit evidence.

## Onboarding

- Submit access request by direct supervisor, explaining role, business scope, required environment, and validity period.
- Production permissions are denied by default; operation scenarios must be explained and approver bound.
- Initial permissions are granted per least privilege, prioritizing groups and roles, not directly binding individuals to long-term privileges.
- All secrets are injected via approved secret manager or deployment environment; writing to `.env`, script parameters, logs, or fixtures is prohibited.

## Permission Changes

- Permission upgrades must record reason, duration, and rollback plan.
- Temporary permissions are automatically reclaimed upon expiration; when automatic reclamation is not possible, calendar reminders and audit records must be established.
- Cross-team access requires dual confirmation from resource owner and security owner.

## Offboarding and Transfer

- On the day of departure, revoke SSO, VPN, code repository, CI/CD, cloud account, database, and observability backend access.
- Rotate shared tokens, bot tokens, and long-term API keys that the individual had access to.
- Review audit logs from the last 30 days to confirm no abnormal exports, privilege escalations, or burst of failed logins.

## Evidence

- Access request form.
- Approval records.
- Permission change diff.
- Secret rotation records.
- Offboarding revocation checklist.
