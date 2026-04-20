# Marketplace Catalog And Revenue Contract

## 1. Scope

This contract defines marketplace catalog, installation governance, revenue sharing, and deprecation lifecycle for `§55`.

## 2. Canonical Objects

- `MarketplaceListing`
- `MarketplaceInstallRecord`
- `RevenueSharePolicy`
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
- `lifecycle_state`
- `pricing_model`

`lifecycle_state`:

- `draft`
- `submitted`
- `certified`
- `published`
- `deprecated`
- `retired`

## 4. Revenue Sharing

`RevenueSharePolicy` must declare at minimum:

- `policy_id`
- `gross_split`
- `tax_handling`
- `refund_policy`
- `settlement_cycle`

## 5. Rules

- Uncertified listings must not enter `published`.
- Dependencies must be explicitly declared and pass compatibility checks.
- Deprecated listings must provide migration or replacement suggestions.

## 6. Test Requirements

- unit: listing schema, dependency validation, settlement calculation
- integration: install / upgrade / retire lifecycle
- contract: listings with revoked certification must not allow new installations