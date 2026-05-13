# Source Of Truth Governance

## 1. Objective

Ensure that each piece of truth is maintained in only one master version, to avoid conflicts between platform design, main documents, ADRs, and contracts.

## 2. Master Rules

- For field, state, and protocol issues, `contracts/` is the authority.
- For long-term architectural boundary issues, `docs_zh/architecture/00-*.md` ~ `04-*.md` are the authority.
- For solution trade-off issues, `adr/` is the authority.
- For new platform design and migration boundaries, the platform architecture documents under `docs_zh/architecture/` in this project are the authority.
- For current progression actions, `operations/` is the authority.

Supplementary note:

- Old system `18_code_architecture.md` and other legacy documents are only for migration reference and are no longer the current project source of truth.

## 3. Change Sequence

1. Update main documents.
2. Update contracts.
3. Supplement ADRs.
4. Update governance / glossary / source-of-truth.
5. Update operations.
6. If old system reference information needs to be preserved, only add it in migration notes; do not backfill old reviews.

## 4. Prohibitions

- Redefining contracts in old review documents.
- Inventing new state machines in operations.
- Continuing to maintain active designs in historical reference materials.
- Writing current completion status in README.
- Allowing terminology in ADRs, contracts, and governance to become misaligned with current implementation boundaries over time.