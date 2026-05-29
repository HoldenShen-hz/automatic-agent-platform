# Security Policy

## Reporting

- Do not open public issues for suspected vulnerabilities.
- Report security issues through the repository's private disclosure channel or the maintainer contact configured for this project.
- Include affected paths, impact, reproduction steps, and whether the issue crosses tenant, sandbox, auth, or secret boundaries.

## Handling Expectations

- Security-sensitive fixes must preserve deny-by-default behavior.
- Changes that alter sandbox, approval, secret, or filesystem-boundary behavior must update the matching contract under `docs_zh/contracts/` and add regression coverage.
