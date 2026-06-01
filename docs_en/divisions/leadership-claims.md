# Leadership Claims

This page anchors the current authoritative directory and governance entry points for “leadership claims landed” in the v3.2 release documentation.

## Authoritative Files

- Claim records: `config/division-coverage/claims/records.yaml`
- Claim allowlist: `config/division-coverage/claims/allowlist.yaml`
- Claim schema: `config/division-coverage/schemas/leadership-claim.schema.json`
- Governance data:
  - `data/governance/leadership-claim-review-requests.json`
  - `data/governance/leadership-claim-status-overrides.json`
  - `data/governance/leadership-claim-scan-report.json`

## Implementation Entry Points

- CI scanner: `scripts/ci/audit-leadership-claims.mjs`
- Repository script entry: `audit:leadership-claims` in `package.json`
- Runtime governance service: `src/platform/shared/stability/leadership-claims-governance-service.ts`
- Admin API: `src/platform/five-plane-interface/api/http-server/admin-routes.ts`
- Release Console UI / API client:
  - `ui/packages/features/release-console/`
  - `ui/packages/shared/api-client/src/endpoints.ts`

## Current Directory Truth

The repository does not currently expose family-scoped files such as `claims/{engineering,knowledge-research,...}.yaml`.  
The authoritative claim directory contract is:

- `config/division-coverage/claims/records.yaml`
- `config/division-coverage/claims/allowlist.yaml`

If family-scoped claim files are introduced later, the schema, scanner, governance service, API, and release docs must be updated together before this index changes.
