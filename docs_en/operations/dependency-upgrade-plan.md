# Dependency Upgrade Plan

## Goal

Establish a repeatable upgrade cadence for the dependency lag issues identified in the review, rather than one-off manual version bumps that lose verification closure.

## Current Governance Scope

This plan covers dependencies explicitly named in the review that have the greatest impact on platform security and build stability:

- `xml-crypto`
- `zod`
- `typescript`
- `@types/node`
- `eslint`

Current repository baseline (from `package.json`):

- `xml-crypto`: `^6.1.2`
- `zod`: `^3.25.76`
- `typescript`: `^5.8.3`
- `@types/node`: `^22.19.15`
- `eslint`: `^9.25.1`

## Upgrade Waves

### Wave 0: Security and Gate Baseline

- Keep `npm audit`, lockfile, and CI coverage/typecheck gates continuously effective.
- For security-related dependencies, first check whether the review's security version floor has been reached; currently `xml-crypto` is aligned with that review baseline, and subsequent tracking follows security advisories.
- Before each upgrade, record the current test matrix and rollback commands to avoid turning "upgrade verification" into evidence-free trial and error.

### Wave 1: Same-major security/compatibility upgrades

- `typescript`: first advance to the latest compatible version within the current 5.x range, then evaluate 6.x.
- `eslint`: first keep the latest compatible version within the 9.x line, and synchronize verification of `typescript-eslint`, `@eslint/js`.
- `@types/node`: prioritize alignment with the repository's declared `node >=20 <23` support range to avoid type definitions jumping ahead of runtime support.

Verification threshold:

- `npm run build:test`
- Affected targeted tests
- Related CI audit scripts

### Wave 2: Major version evaluation

- `zod`: separately establish a breaking-change list from 3.x to 4.x, with key focus on schema transform, error shape, inferred types, and ecosystem compatibility.
- `eslint`: wait for surrounding plugins and configuration chains to support before evaluating 10.x.
- `@types/node`: only when Node support range advances to the 24/25 series, simultaneously push forward the higher major.

Verification threshold:

- Migration notes retained in the upgrade branch
- Key usage points have targeted regression
- If configuration format changes are involved, supplement documentation and audit

### Wave 3: Toolchain major version upgrades

- `typescript` 6.x handled in a separate wave, not mixed with business dependency upgrades.
- Before upgrading, confirm that `tsx`, `typescript-eslint`, `@stryker-mutator/typescript-checker` have no blocking compatibility issues with compilation output.
- If type system regressions occur broadly, roll back using "first lock version, then enumerate migration list" approach; do not stuff major version migration into ordinary bug fixes.

## Cadence and Ownership

- Cadence: Monthly dependency review; complete at least one upgrade wave per quarter.
- Triggers: Immediately process ahead of schedule when high-severity vulnerabilities, Node LTS changes, CI toolchain incompatibilities, or review re-targeting occur.
- Ownership: Platform maintainers handle upgrade implementation; CI audit prevents unplanned drift or degradation.

## Commit Requirements

- Upgrade PRs must list the wave, affected dependencies, compatibility conclusions, and rollback methods.
- Major bumps must include breaking-change summaries; version numbers alone are insufficient.
- If an upgrade is deferred, the blocker and next review date must be recorded; simply marking as "later" is not acceptable.