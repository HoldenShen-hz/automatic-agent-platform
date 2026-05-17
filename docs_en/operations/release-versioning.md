# Release and Version Strategy

This document defines the minimal release version scope for the current repository.

## NPM / Source Code Version

- `version` in `package.json` is the source package version authoritative source.
- Version changes must be accompanied by a changelog gate.
- Node/npm support range is declared by the `engines` field in `package.json`.

## Image Version

- Release workflow must use the `image_tag` passed by the caller.
- Image release also generates a `sha-<commit>` tag for rollback and traceability.
- Deploy workflow only deploys explicitly passed image tags; no floating latest.

## Branch Strategy

- `main` is the only releasable branch; release, deploy, and rollback evidence are all based on commits on `main`.
- `codex/*`, `fix/*`, `feature/*` branches are only allowed as short-term working branches; before merging, targeted verification for the corresponding issue/table row must be completed.
- Long-unmerged branches must not serve as authoritative sources; if history needs to be preserved, corresponding evidence should be recorded in the review table or operations documents, not relying on remote branch names.

## Commit Messages

- Commit titles use short imperative mood, describing specific behavioral changes, e.g., `Add worker handshake lifecycle`.
- Semanticless titles are prohibited as final commit descriptions, e.g., `chore: sync`, `update`, `fix`.
- Each commit covers only one issue cluster; if runtime code and documentation are modified simultaneously, the commit description must name the verification command or evidence file.