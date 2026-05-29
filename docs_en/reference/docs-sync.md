# Chinese-English Documentation Sync Rules

`docs_zh/` is the Chinese primary document collection, `docs_en/` holds English materials. Both are allowed to have release time differences, but key contracts and operation documents must not drift long-term.

## Must Sync Content

- Platform architecture overview and five-layer boundaries.
- Contract documents, including `docs_zh/contracts/` and `docs_en/contracts/`.
- ADR decisions affecting runtime, release, security, and compatibility.
- Operations runbook, security processes, and recovery processes.
- API/SDK version documentation.

## Sync Process

1. When key changes occur on either Chinese or English side, mark in PR whether sync is needed.
2. First determine the directory:
   - `docs_zh/contracts/` -> `docs_en/contracts/`
   - `docs_zh/adr/` -> `docs_en/adr/`
   - `docs_zh/operations/` -> `docs_en/operations/`
   - `docs_zh/reference/` -> `docs_en/reference/`
3. If deferring translation, must state reason and tracking item.
4. Before version freeze, major release, and security changes, must spot-check key documents on both sides.

## Minimum Checklist

- Whether key Chinese changes have corresponding English sibling.
- Whether contract / ADR / runbook links still point to same language directory.
- Whether README/index already includes new files or new canonical paths.
- If only Chinese authoritative page exists, whether English side has alias, stub, or sync pending note.

## Evidence

- PR link.
- Corresponding document path.
- Sync status description.