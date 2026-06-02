# Security Policy

## Reporting

- Do not open public issues for suspected vulnerabilities.
- Use the repository's private disclosure channel first. If a platform operator has published a security mailbox or PGP key for the current deployment, use that operator-managed contact as the preferred intake path.
- Include affected paths, impact, reproduction steps, environment assumptions, and whether the issue crosses tenant, sandbox, auth, approval, or secret boundaries.

## Disclosure Targets

- Preferred contact: repository private disclosure / security advisory channel.
- Operator-managed mailbox or PGP key: deployment-specific and maintained outside this repository.
- Public issues are acceptable only after coordinated disclosure and a fix or mitigation is available.

## Response Expectations

- Intake acknowledgement target: within 3 business days.
- Initial triage target: within 7 calendar days.
- Coordinated disclosure target: 30 days for medium severity, 14 days for high or critical severity unless a wider incident response process is required.
- If a CVE is warranted, the maintainer or deployment operator handling disclosure owns CNA coordination or equivalent downstream filing.

## Repository Security Requirements

- Security-sensitive changes must preserve deny-by-default behavior.
- Changes that alter sandbox, approval, secret, auth, or filesystem-boundary behavior must update the matching contract under `docs_zh/contracts/` and add regression coverage.
- Supply-chain controls, `npm audit` expectations, CodeQL, and image scanning requirements are governed by [docs_zh/quality/supply-chain-security.md](./docs_zh/quality/supply-chain-security.md).

## Non-Goals

- This repository policy does not publish a single hard-coded global mailbox because deployments may be operated by different organizations.
- Runtime operators may add stricter disclosure SLAs or additional contacts, but they must not weaken the private-first reporting flow above.
