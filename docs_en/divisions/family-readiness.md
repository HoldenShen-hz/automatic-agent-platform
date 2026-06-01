# Family Readiness

This page anchors the current authoritative meaning of “family readiness landed” used by the v3.2 release documentation, so the directory tree does not drift away from machine-readable config again.

## Authoritative Sources

- Family readiness baseline config: `config/division-coverage/family-readiness.yaml`
- Benchmark mapping: `config/division-coverage/benchmark-map.yaml`
- Minimum leading evidence: `config/division-coverage/minimum-leading-evidence.yaml`
- Governance snapshots:
  - `data/governance/leadership-claim-review-requests.json`
  - `data/governance/leadership-claim-status-overrides.json`
  - `data/governance/leadership-claim-scan-report.json`
- Runtime governance service: `src/platform/shared/stability/leadership-claims-governance-service.ts`

## Current Directory Truth

`docs_en/divisions/` is not currently a flat “one readiness summary per family” layout. The repository instead exposes two material groups:

- `family-expansion/`
  - Expansion proposals, prioritization, and next-step landing paths by family.
- `*/leadership-evidence/`
  - Evidence bundles for enabled families such as coding, customer-service, and knowledge-base, including evaluation, risk, ROI, red-team, and release-readiness artifacts.

## Usage Rules

- `family-readiness.yaml` remains the machine-readable source of truth for readiness decisions; this page is an index, not a replacement.
- “Family readiness” does not mean “claim approved for external publication”.
- Public claim authority comes from `config/division-coverage/claims/records.yaml`, plus runtime review / override / revoke state.
- If this page drifts from machine-readable config or governance snapshots, the config and snapshots win and the release doc must be updated accordingly.
