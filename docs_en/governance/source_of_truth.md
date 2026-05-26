# Source Of Truth Governance

## 1. Objective

Ensure that each piece of facts is maintained in only one authoritative version, preventing platform design, trunk documents, ADRs, and contracts from conflicting with each other.

## 2. Primary Rules

- For fields, status, and protocol questions, `contracts/` is authoritative.
- For long-term architectural boundary questions, `docs_zh/architecture/00-*.md` ~ `04-*.md` are authoritative.
- For solution trade-off questions, `adr/` is authoritative.
- For new platform design and migration boundaries, the platform architecture documents under this project's `docs_zh/architecture/` are authoritative.
- For current push actions, `operations/` is authoritative.

Supplementary notes:

- The legacy system `18_code_architecture.md` and other old documents are to be used only as migration reference and are no longer the current project's source of truth.

## 3. Change Sequence

1. Update the trunk document.
2. Update the contract.
3. Supplement the ADR.
4. Update governance / glossary / source-of-truth.
5. Update operations.
6. If legacy system reference information needs to be preserved, add it only in the migration notes; do not backfill old reviews.

## 4. Prohibited Actions

- Redefining contracts in old review documents.
- Inventing new state machines in operations.
- Continuing to maintain active designs in historical reference materials.
- Writing current completion status in README.
- Allowing terminology in ADR, contract, and governance to become misaligned with current implementation boundaries over the long term.
