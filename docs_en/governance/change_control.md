# Change Control

---

## OAPEFLIR Relevance

This governance document regulates the following aspects of the OAPEFLIR eight-stage cognitive loop:

- **Observe**: Signal collection vs governance boundary
- **Assess**: Execution evaluation vs permission governance
- **Plan**: Planning constraints vs R3 hard constraints
- **Execute**: Execution permissions vs security boundary
- **Feedback**: Feedback signal governance vs classification
- **Learn**: Learning content validation vs promotion boundary
- **Improve**: Improvement candidate approval vs Rollout governance
- **Release**: Release permissions vs auto-rollback rules

---

##1. Objective

Define the minimum governance process for document and design changes, avoiding starting coding before the design is finalized.

##2. Scope

Applies to:

- Adding new core contracts.
- Modifying main architectural boundaries.
- Adjusting phase scope.
- Introducing high-risk new capabilities.

##3. Minimum Process

1. Update the mainline document or contract first.
2. If trade-offs are involved, add an ADR.
3. If it affects current implementation order, update operations.
4. If it affects current judgment, update reviews.

##4. Pre-Coding Requirements

- If the contract is not stable, do not directly write corresponding core code.
- If reviews still have clearly identified P0 document gaps, prioritize completing the documents.

##5. Change Request Template

All changes to core contracts, architecture, and mainline documents must be formally submitted using the following template:

```markdown
## Change Title
[Brief description of change intent]

## Change Type
- [] New contract
- [] Modify contract
- [] Main architectural boundary adjustment
- [] Phase scope adjustment
- [] High-risk new capability introduction

## Impact Scope
- Affected files/modules:
- Affected systems:
- Rollback complexity (low/medium/high):

## Reason for Change
[Why this change is being made]

## Alternative Approaches
[If any, list at least one alternative and why it was not chosen]

## Approval Process
| Step | Approver | Status |
|------|--------|------|
|1. Document draft | TBD | [] |
|2. ADR review (if applicable) | TBD | [] |
|3. Code review | TBD | [] |
|4. Integration testing | CI | [] |
|5. Approver sign-off | TBD | [] |

## Related Links
- Related ADR:
- Related contract:
- Related issue/PR:
```

##6. Approval Role Definitions

| Role | Responsibility | Applicable Changes |
|------|------|---------|
| Architect | Approve main architectural boundary changes | §4-§9 Platform infrastructure layer |
| Technical Lead | Approve contract field changes | All contract files |
| Operations Lead | Approve operations process changes | `docs_zh/operations/` |
| Security Review | Approve high-risk new capabilities | New features with security impact |

##7. Toolchain References

- **Document Tracking**: Manage change requests via GitHub PR / Issues
- **ADR Management**: [`docs_zh/adr/README.md`](../adr/README.md)
- **Contract Registry**: [`docs_zh/contracts/README.md`](../contracts/README.md)
- **Architecture Index**: [`docs_zh/architecture/README.md`](../architecture/README.md)
- **Status Tracking**: Each review document under [`docs_zh/reviews/`](../reviews/)
