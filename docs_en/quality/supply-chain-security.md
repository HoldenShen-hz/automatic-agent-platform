# Supply Chain Security Baseline

This document records auditable supply chain security entry points within the repository.

## Must Be Retained

- `package-lock.json` must be committed, CI uses `npm ci`.
- CI must run `npm audit --audit-level=high`.
- Supply chain audit evidence is based on CI output SARIF / audit logs, no need to embed additional signed text in `package-lock.json`.
- CI must run CodeQL TypeScript analysis.
- Container images must be scanned by Trivy CRITICAL/HIGH.
- Release images must use explicit tags with commit sha tag attached.

## Change Rules

- New dependencies must explain purpose, runtime surface, and alternatives.
- Dependency upgrades containing breaking changes must include minimal targeted tests.
- Security vulnerabilities are not allowed to bypass with static whitelists long-term; exceptions must have expiration date and owner.