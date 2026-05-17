# Security Access Lifecycle

This document defines the access lifecycle for personnel, service accounts, and automated credentials, covering onboarding authorization, permission changes, offboarding revocation, and audit retention.

## Onboarding

- Access requests must be submitted by the direct supervisor, specifying role, business scope, required environment, and validity period.
- Production permissions are denied by default; operation scenarios must be stated and approvers must be bound.
- Initial permissions are granted based on least privilege, prioritizing groups and roles rather than directly binding long-term privileges to individuals.
- All secrets must be injected through approved secret managers or deployment environments; writing to `.env`, script parameters, logs, or fixtures is prohibited.

## Permission Changes

- Permission upgrades must record reasons, duration, and rollback plans.
- Temporary permissions are automatically revoked upon expiration; when automatic revocation is not possible, calendar reminders and audit records must be established.
- Cross-team access requires dual confirmation from resource owner and security owner.

## Offboarding and Transfer

- On the day of offboarding, revoke access to SSO, VPN, code repositories, CI/CD, cloud accounts, databases, and observability backends.
- Rotate shared tokens, bot tokens, and long-term API keys that individuals have accessed.
- Review audit logs from the last 30 days to confirm no abnormal exports, privilege escalations, or burst of failed logins.

## Evidence

- Access request forms.
- Approval records.
- Permission change diffs.
- Secret rotation records.
- Offboarding revocation checklist.