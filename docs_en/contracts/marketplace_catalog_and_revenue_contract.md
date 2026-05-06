# Marketplace Catalog And Revenue Contract

## 1. Scope

This contract defines marketplace catalog for `§55`, installation governance, commercial metadata projection, and deprecation lifecycle.

## 2. Canonical Objects

- `MarketplaceListing`
- `MarketplaceInstallRecord`
- `CommercialTermsProjection`
- `CertificationRecord`
- `ListingDependency`

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

`CommercialTermsProjection` at minimum declares:

- `policy_id`
- `pricing_model`
- `catalog_price_ref`
- `revenue_share_ref?`
- `tax_policy_ref?`
- `refund_policy_ref?`
- `settlement_cycle_ref?`

Rules:

- Commercial metadata is only allowed as marketplace catalog / invoice / settlement projection input.
- `revenue_share_ref`, `tax_policy_ref`, `refund_policy_ref`, `settlement_cycle_ref` must not participate in Pack execution authorization, installation security judgment, or runtime sandbox decisions.
- Marketplace install / activation / deprecation execution and security gate can only consume `trust_level`, `capabilities`, dependency constraints, and certification results.

## 5. Rules

- Uncertified entries must not enter `active`.
- Dependencies must be explicitly declared and pass compatibility checks.
- Deprecated entries must provide migration or alternative suggestions.
- `sunset` entries must not accept new installations but allow controlled migration or read-only viewing.
- `removed` entries must not be newly installed, upgraded, or activated.

## 6. Test Requirements

- unit: listing schema, dependency validation, commercial projection validation
- integration: install / upgrade / deprecate / sunset / remove lifecycle
- contract: Entries with revoked certification must not continue new installations



## v4.3 Architecture Remediation

The following items fix contract deviations recorded in `platform-architecture-implementation-consistency-audit.md`. If historical paragraphs of this document conflict with this section, this section, `docs_zh/architecture/00-platform-architecture.md`, ADR-109 to ADR-113, and `src/platform/contracts/executable-contracts/` take precedence.

- T-36: This document originally directly listed `RevenueSharePolicy` as a canonical marketplace object. Root cause: early marketplace contract wrote commercial settlement domain and runtime installation/security governance in the same layer, causing settlement fields to appear like they could participate in Pack execution gate. Fix: The text now demotes this semantics to `CommercialTermsProjection`, and clarifies revenue sharing/tax/refund/settlement cycle can only be commercial projection and must not affect installation security or runtime decisions.
- T-43: This document originally stuffed `draft / submitted / certified / published / deprecated / retired` all into `lifecycle_state`. Root cause: historical documentation mixed "review workflow status" and "runtime available lifecycle" into one enumeration, without separating review workflow from runtime lifecycle in v4.3. Fix: The text now adds `review_status` to carry `draft / submitted / certified`, and converges `lifecycle_state` to `active / deprecated / sunset / removed`.

Mandatory rules: State transitions must go through `RuntimeStateMachine.transition(command)`; execution plans must use `PlanGraphBundle`; execution results must use `NodeAttemptReceipt`; truth events can only use `platform.*`; OAPEFLIR can only be used as `oapeflir.view.*` / rationale projection; budgets must use `BudgetLedger` / `BudgetReservation` / `BudgetSettlement`.
