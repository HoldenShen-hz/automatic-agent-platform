# Security Onboarding and Offboarding Process

This document defines the access lifecycle for personnel, service accounts, and automation credentials, covering onboarding authorization, permission changes, offboarding recovery, and audit trails.

## Onboarding

- Direct supervisor submits access request, describing role, business scope, required environment, and validity period.
- Production permissions default to deny; operation scenario must be described and an approver must be bound.
- Initial permissions are granted according to least privilege, prioritizing groups and roles, not directly binding long-term privileges to individuals.
- All secrets are injected via approved secret manager or deployment environment; writing to `.env`, script parameters, logs, and fixtures is prohibited.

## Permission Changes

- Permission upgrades must record reason, duration, and rollback plan.
- Temporary permissions are automatically revoked upon expiration; when automatic revocation is not possible, calendar reminders and audit records must be established.
- Cross-team access requires dual confirmation from resource owner and security owner.

## Offboarding and Role Transfer

- On the day of departure, revoke access to SSO, VPN, code repository, CI/CD, cloud accounts, database, and observability backend.
- Rotate shared tokens, bot tokens, and long-term API keys that the individual has accessed.
- Review the most recent30 days of audit logs to confirm no abnormal exports, privilege escalations, or failed login bursts.

## Evidence

- Access request form.
- Approval records.
- Permission change diff.
- Secret rotation records.
- Offboarding recovery checklist.
