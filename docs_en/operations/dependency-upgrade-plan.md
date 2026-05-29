# Dependency Upgrade Plan

## Goal

Establish a sustainable upgrade rhythm for dependency lag issues identified in reviews, rather than one-time manual version bumps that lose verification closure.

## Current Governance Scope

This plan covers dependencies explicitly named in reviews that have the greatest impact on platform security and build stability:

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

- Keep `npm audit`, lockfile, CI coverage/typecheck gates continuously effective.
- Security-related dependencies first check whether they have reached the security version floor identified in reviews; currently `xml-crypto` is aligned with that review baseline, and will continue tracking based on security announcements.
- Before each upgrade, record current test matrix and rollback commands to avoid turning "upgrade verification" into evidence-free manual trial and error.

### Wave 1: Same-major Security/Compatibility Upgrades

- `typescript`: First advance to the latest compatible version in current 5.x, then evaluate 6.x.
- `eslint`: First stay on the latest compatible version in 9.x line, and synchronously verify `typescript-eslint`, `@eslint/js`.
- `@types/node`: Prioritize alignment with the repository's declared `node >=22 <23` supported range, avoiding type definitions getting ahead of runtime support.

Verification threshold:

- `npm run build:test`
- Impacted targeted tests
- Related CI audit scripts

### Wave 2: Major Version Evaluation

- `zod`: Separately establish breaking-change list from 3.x to 4.x, focusing on schema transform, error shape, inferred types, and ecosystem compatibility.
- `eslint`: Wait for surrounding plugins and configuration chain support before evaluating 10.x.
- `@types/node`: Only when Node support range increases to 24/25 series, synchronously advance higher major.

Verification threshold:

- Retain migration description in upgrade branch
- Key usage points have targeted regression
- If configuration format changes are involved, supplement documentation and audits

### Wave 3: Toolchain Major Version Upgrades

- `typescript` 6.x enters a separate wave, not mixed with business dependency upgrades.
- Before upgrading, must confirm `tsx`, `typescript-eslint`, `@stryker-mutator/typescript-checker` have no blocking compatibility issues with compilation output.
- If large-scale type system regressions occur, roll back using "first lock version, then demolish migration list" approach; do not stuff major version migration into ordinary bug fixes.

## Rhythm and Responsibilities

- Rhythm: Monthly dependency review; complete at least one upgrade wave per quarter.
- Triggers: Immediately handle ahead of schedule when high-severity vulnerabilities, Node LTS changes, CI toolchain incompatibilities, or re-review naming occurs.
- Responsibilities: Platform maintainers handle upgrade implementation; CI audits prevent unplanned drift or degradation.

## Submission Requirements

- Upgrade PR must list this wave, impacted dependencies, compatibility conclusions, and rollback methods.
- Major bumps must include breaking-change summaries, not just version numbers.
- If deciding to defer upgrade, must record blocking items and next review time, cannot simply mark as "handle later".