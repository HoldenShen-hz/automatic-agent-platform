# Source Of Truth Governance

##1. Objective

Ensure that the same fact is maintained in only one master version, avoiding conflicts between platform design, mainline documents, ADRs, and contracts.

##2. Main Rules

- Field, status, and protocol issues defer to `contracts/`.
- Long-term architectural boundary issues defer to `docs_zh/architecture/00-*.md` ~ `04-*.md`.
- Approach trade-off issues defer to `adr/`.
- New platform design and migration boundaries defer to the platform architecture documents under this project's `docs_zh/architecture/`.
- Current advancement actions defer to `operations/`.

Supplementary:

- Legacy system `18_code_architecture.md` and other old documents serve only as migration reference and are no longer the current project source of truth.

##3. Change Order

1. Modify mainline document.
2. Modify contract.
3. Add ADR.
4. Update governance / glossary / source-of-truth.
5. Update operations.
6. If legacy system comparison information needs to be preserved, only add it in migration descriptions, do not backfill into old reviews.

##4. Prohibited Items

- Redefining contracts in old review documents.
- Inventing new state machines in operations.
- Continuing to maintain active designs in historical reference materials.
- Writing current completion status in README.
- Allowing terminology in ADR, contract, governance to remain mismatched with current implementation boundaries long-term.
