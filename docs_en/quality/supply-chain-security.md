# Supply Chain Security Baseline

This document records auditable supply chain security entry points in the repository.

## Must Retain

- `package-lock.json` must be committed, CI uses `npm ci`.
- CI must run `npm audit --audit-level=high`.
- Supply-chain audit evidence is the CI-generated SARIF / audit log output; the repository does not require extra signature text to be embedded inside `package-lock.json`.
- CI must run CodeQL TypeScript analysis.
- Container images must be scanned by Trivy CRITICAL/HIGH.
- Release images must use explicit tags and include commit sha tags.

## Change Rules

- New dependencies must explain purpose, execution surface, and alternatives.
- Dependency upgrades containing breaking changes must include minimum targeted tests.
- Security vulnerabilities must not be bypassed with static whitelists long-term; exceptions must have expiration dates and owners.
