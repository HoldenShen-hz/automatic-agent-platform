# Source Of Truth Governance

## 1. Goal

Ensure the same fact is maintained in only one master version, and avoid platform design, main documents, ADRs, and contracts from conflicting with each other.

## 2. Main Rules

- Field, state, and protocol issues take `contracts/` as standard.
- Long-term architecture boundary issues take `01` ~ `07` as standard.
- Plan trade-off issues take `adr/` as standard.
- New platform design and migration boundaries take the two platform documents under `automatic_agent_platform/` as standard.
- Current push actions take `operations/` as standard.

Supplementary:

- Old-system documents such as `18_code_architecture.md` remain migration references only and are not current sources of truth.

## 3. Change Sequence

1. Modify main documents.
2. Modify contracts.
3. Supplement ADR.
4. Update governance/glossary/source-of-truth.
5. Update operations.
6. If old-system comparison must be kept, add it to migration notes rather than reviving legacy reviews.

## 4. Prohibitions

- Redefine contracts in legacy review documents.
- Invent new state machines in operations.
- Continue maintaining active designs in historical reference materials.
- Write current completion in README.
- Let ADR, contract, governance terminology long-term drift from current implementation boundaries.
