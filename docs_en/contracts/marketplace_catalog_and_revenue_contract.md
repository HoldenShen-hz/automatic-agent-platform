# Marketplace Catalog And Revenue Contract

## 1. Scope

This contract defines the market catalog, installation governance, commercial metadata projection, and deprecation lifecycle for `§55`.

## 2. Canonical Objects

- `MarketplaceListing`
- `MarketplaceInstallRecord`
- `CommercialTermsProjection`
- `CertificationRecord`
- `ListingDependency`
- `PluginTrustRoot`
- `PluginProvenanceAttestation`
- `RevokedPluginArtifact`

## 3. `MarketplaceListing` Minimum Fields

- `listing_id`
- `publisher_id`
- `artifact_type`
- `artifact_ref`
- `version`
- `capabilities`
- `trust_level`
- `review_status`
- `lifecycle_state`
- `pricing_model`

`review_status`:

- `draft`
- `submitted`
- `certified`

`lifecycle_state`:

- `active`
- `deprecated`
- `sunset`
- `removed`

## 4. Revenue Sharing

`CommercialTermsProjection` must at minimum declare:

- `policy_id`
- `pricing_model`
- `catalog_price_ref`
- `revenue_share_ref?`
- `tax_policy_ref?`
- `refund_policy_ref?`
- `settlement_cycle_ref?`

Rules:

- Commercial metadata is only allowed as projection input for marketplace catalog / invoice / settlement.
- `revenue_share_ref`, `tax_policy_ref`, `refund_policy_ref`, and `settlement_cycle_ref` must not participate in Pack execution authorization, installation security decisions, or runtime sandbox decisions.
- Marketplace install / activation / deprecation execution and security gates may only consume `trust_level`, `capabilities`, dependency constraints, and certification results.

## 5. Rules

- Uncertified entries must not enter `active`.
- Dependencies must be explicitly declared and pass compatibility checks.
- Deprecated entries must provide migration or alternative suggestions.
- `sunset` entries must not accept new installations, but allow controlled migration or read-only viewing.
- `removed` entries must not be newly installed, upgraded, or activated.
- Artifacts from non-internal publishers must find a matching trust root in `PluginTrustRoot`.
- Artifacts must retain provenance attestation, including at minimum `source_uri / manifest_checksum / sbom_digest / signature_digest`.
- Artifacts written to `RevokedPluginArtifact` must immediately block new installations and new activations.
- Install gate must simultaneously verify `signature / sbom / sandbox / egress review`, and provide recommended `required_isolation_mode`.

## 6. Test Requirements

- unit: listing schema, dependency validation, commercial projection validation
- integration: install / upgrade / deprecate / sunset / remove lifecycle
- contract: Entries with revoked certification must not continue new installations


## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If any historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-36: This document originally listed `RevenueSharePolicy` directly as a canonical marketplace object. The root cause was that early market contracts placed commercial settlement domain and runtime installation/security governance at the same layer, causing settlement fields to appear as if they could participate in Pack execution gates. Fix: The main text now demotes this semantics to `CommercialTermsProjection`, and explicitly states that revenue sharing / tax / refund / settlement cycle may only serve as commercial projections and must not affect installation security or runtime decisions.
- T-43: This document originally crammed `draft / submitted / certified / published / deprecated / retired` all into `lifecycle_state`. The root cause was historical copy that mixed "review workflow status" and "runtime availability lifecycle" into a single enum, failing to separate review workflow from runtime lifecycle in v4.3. Fix: The main text now adds `review_status` to carry `draft / submitted / certified`, and consolidates `lifecycle_state` to `active / deprecated / sunset / removed`.

Mandatory Rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events may only use `platform.*`; OAPEFLIR may only serve as `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.