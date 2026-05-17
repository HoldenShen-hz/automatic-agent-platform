# Chinese-English Documentation Sync Rules

`docs_zh/` is the Chinese primary documentation collection, and `docs_en/` stores English materials. Both are allowed to have publication time gaps, but key contracts and operational documents must not drift apart long-term.

## Content That Must Be Synced

- Platform architecture overview and five-plane boundaries.
- Contracts/agreements documents.
- ADRs with decisions affecting runtime, release, security, and compatibility.
- Operations runbooks, security processes, and recovery procedures.
- API/SDK version documentation.

## Sync Process

1. When a key change occurs on either the Chinese or English side, mark in the PR whether sync is required.
2. If deferring translation, must state the reason and tracking item.
3. Before version freeze, major releases, and security changes, spot-check key documents on both sides.

## Evidence

- PR links.
- Corresponding document paths.
- Sync status description.