# Release and Version Strategy

This document defines the minimum release version scope for the current repository.

## NPM / Source Code Version

- `version` in `package.json` is the source of truth for source package version.
- Current release baseline version: `0.2.0`
- `CHANGELOG.md` must simultaneously maintain `Unreleased` and the most recent released version to avoid accidentally writing unreleased commits as released facts.
- Current repository is still in `0.x` pre-GA stage: frequent contract/docs changes do not require bumping `package.json` on every commit, but once publishing a package or image, must write back to changelog.
- Version changes must include changelog gate.
- Node/npm support range is declared by `engines` field in `package.json`.
- `deploy/helm/automatic-agent/Chart.yaml`'s `version/appVersion` must stay consistent with `package.json version`; `audit:ci-supply-chain` is responsible for preventing drift.

## Image Version

- Release workflow must use caller-passed `image_tag`.
- `Dockerfile` base image must use explicit version + digest (e.g., `node:22.21.1-bookworm-slim@sha256:...`) to avoid tag drift.
- Image release simultaneously generates `sha-<commit>` tag for rollback and traceability.
- Deployment workflow only deploys explicitly passed image tag, does not use floating latest.
- Hard gate checks before version release see Pre-Launch Top 20 Hard Checklist in [operations-checklist.md](./operations-checklist.md).

## Branch Strategy

- `main` is the only releasable branch; release, deployment and rollback evidence are all based on commits on `main`.
- `codex/*`, `fix/*`, `feature/*` branches are only allowed as short-term working branches; must complete corresponding issue/table row targeted verification before merging.
- Long-unmerged branches cannot be used as source of truth; if historical preservation needed, should record corresponding evidence in review table or operations document, not rely on remote branch name.

## Commit Messages

- Commit titles use short imperative mood, describing specific behavioral changes, e.g., `Add worker handshake lifecycle`.
- Prohibited from using semantically empty titles as final commit descriptions, e.g., `chore: sync`, `update`, `fix`.
- One commit only covers one issue cluster; if simultaneously modifying runtime code and docs, commit description must name verification commands or evidence files.

## Related Documents

- Pre-release checklist: [operations-checklist.md](./operations-checklist.md)
- Authoritative version record: [../../CHANGELOG.md](../../CHANGELOG.md)
- Release/rollback execution contract: [../contracts/release_rollout_and_rollback_contract.md](../contracts/release_rollout_and_rollback_contract.md)