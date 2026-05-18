# Marketplace Catalog And Revenue Contract

## 1. Scope

This contract defines marketplace catalog, installation governance, commercial metadata projection, and deprecation lifecycle for `§55`.

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

`CommercialTermsProjection` declares at minimum:

- `policy_id`
- `pricing_model`
- `catalog_price_ref`
- `revenue_share_ref?`
- `tax_policy_ref?`
- `refund_policy_ref?`
- `settlement_cycle_ref?`

Rules:

- Commercial metadata is allowed only as projection input for marketplace catalog / invoice / settlement.
- `revenue_share_ref`, `tax_policy_ref`, `refund_policy_ref`, `settlement_cycle_ref` must not participate in Pack execution authorization, installation security determination, or runtime sandbox decisions.
- Marketplace install / activation / deprecation execution and security gates can only consume `trust_level`, `capabilities`, dependency constraints, and certification results.

## 5. Rules

- Uncertified listings must not enter `active`.
- Dependencies must be explicitly declared and pass compatibility checks.
- Deprecated listings must provide migration or alternative suggestions.
- `sunset` listings must not accept new installations but allow controlled migration or read-only viewing.
- `removed` listings must not be newly installed, upgraded, or activated.
- Artifacts from non-internal publishers must find a matching trust root in `PluginTrustRoot`.
- Artifacts must retain provenance attestation, containing at minimum `source_uri / manifest_checksum / sbom_digest / signature_digest`.
- Artifacts written to `RevokedPluginArtifact` must immediately block new installation and new activation.
- Install gate must simultaneously verify `signature / sbom / sandbox / egress review` and give recommended `required_isolation_mode`.

## 6. Test Requirements

- unit: listing schema, dependency validation, commercial projection validation
- integration: install / upgrade / deprecate / sunset / remove lifecycle
- contract: Listings with revoked certification must not continue new installations

## v4.3 Architecture Remediation

The following entries fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical sections of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 through ADR-113, and `src/platform/contracts/executable-contracts/` shall prevail.

- T-36: This document originally directly listed `RevenueSharePolicy` as a canonical marketplace object. The root cause was that the early marketplace contract wrote commercial settlement domain and runtime installation/security governance on the same layer, causing settlement fields to appear able to participate in Pack execution gates. Fix: The body now demotes this semantic to `CommercialTermsProjection` and explicitly states that revenue sharing/tax/refund/settlement cycle can only be commercial projections and must not affect installation security or runtime decisions.
- T-43: This document originally stuffed `draft / submitted / certified / published / deprecated / retired` all into `lifecycle_state`. The root cause was that historical copy mixed "review workflow status" and "runtime available lifecycle" into one enum without separating review workflow from runtime lifecycle in v4.3. Fix: The body now adds `review_status` to carry `draft / submitted / certified` and converges `lifecycle_state` to `active / deprecated / sunset / removed`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events must only use `platform.*`; OAPEFLIR can only be `oapeflir.view.*` / rationale projections; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
