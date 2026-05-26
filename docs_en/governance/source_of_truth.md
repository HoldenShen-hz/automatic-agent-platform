# Source Of Truth Governance

## 1. Objective

Ensure that the same fact is maintained in only one master copy, avoiding conflicts between platform design, main documents, ADRs, and contracts.

## 2. Master Rules

- For field, state, and protocol issues, `contracts/` is the authority.
- For long-term architectural boundary issues, `docs_zh/architecture/00-*.md` ~ `04-*.md` are the authority.
- For scheme trade-off issues, `adr/` is the authority.
- For new platform design and migration boundaries, platform architecture documents under this project's `docs_zh/architecture/` are the authority.
- For current推进 actions, `operations/` is the authority.

Supplementary:

- Old system `18_code_architecture.md` and other old documents serve only as migration references and are no longer current project sources of truth.

## 3. Change Order

1. Modify main documents.
2. Modify contracts.
3. Supplement ADR.
4. Update governance / glossary / source-of-truth.
5. Update operations.
6. If old system reference information needs to be preserved, only supplement in migration instructions; do not backfill old reviews.

## 4. Prohibited Items

- Redefining contracts in old review documents.
- Inventing new state machines in operations.
- Continuing to maintain active designs in historical reference materials.
- Writing current completion status in README.
- Allowing terminology of ADRs, contracts, and governance to long-term mismatch current implementation boundaries.
