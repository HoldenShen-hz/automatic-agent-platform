# Source Of Truth Governance

## 1. Objective

Ensure that the same fact is maintained in only one master version, preventing conflicts between platform design, main documents, ADRs, and contracts.

## 2. Master Rules

- Field, status, and protocol issues defer to `contracts/`.
- Long-term architecture boundary issues defer to `01` ~ `07`.
- Solution trade-off issues defer to `adr/`.
- New platform design and migration boundaries defer to the two platform documents under `automatic_agent_platform/`.
- Current advancement actions defer to `operations/`.

Supplementary:

- Legacy system `18_code_architecture.md` and other old documents serve as migration references only; they are no longer the current project source of truth.

## 3. Change Sequence

1. Update main documents.
2. Update contracts.
3. Add ADRs.
4. Update governance / glossary / source-of-truth.
5. Update operations.
6. If legacy system reference information needs to be preserved, only add it to migration documentation; do not backfill old reviews.

## 4. Prohibitions

- Redefining contracts in old review documents.
- Inventing new state machines in operations.
- Continuing to maintain active designs in historical reference materials.
- Writing current completion status in README.
- Allowing terminology in ADRs, contracts, and governance to become misaligned with current implementation boundaries over time.
