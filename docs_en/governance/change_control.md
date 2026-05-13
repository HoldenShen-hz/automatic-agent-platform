# Change Control

---

## OAPEFLIR Association

This governance document governs the following content in the OAPEFLIR eight-stage cognitive cycle:

- **Observe**: Signal collection and governance boundaries
- **Assess**: Execution assessment and permission governance
- **Plan**: Planning constraints and R3 hard constraints
- **Execute**: Execution permissions and security boundaries
- **Feedback**: Feedback signal governance and classification
- **Learn**: Learning content validation and promotion boundaries
- **Improve**: Improvement candidate approval and Rollout governance
- **Release**: Release permissions and automatic rollback rules

---

## 1. Objective

Define the minimum governance process for document and design changes to avoid starting coding before drafts are finalized.

## 2. Scope

Applicable to:

- Adding new core contracts.
- Modifying main architecture boundaries.
- Adjusting phase scope.
- Introducing high-risk new capabilities.

## 3. Minimum Process

1. First update main documents or contracts.
2. If trade-offs are involved, supplement ADRs.
3. If current implementation sequence is affected, update operations.
4. If current decisions are affected, update reviews.

## 4. Pre-Coding Requirements

- If a contract is not stable, corresponding core code should not be written directly.
- If P0 document gaps still clearly exist in reviews, documents should be prioritized for completion.

## 5. Change Request Template

All core contract, architecture, and main document changes must be formally submitted via the following template:

```markdown
## Change Title
[Brief description of change intent]

## Change Type
- [ ] New contract
- [ ] Modify contract
- [ ] Main architecture boundary adjustment
- [ ] Phase scope adjustment
- [ ] High-risk new capability introduction

## Impact Scope
- Affected files/modules:
- Affected systems:
- Rollback complexity (Low/Medium/High):

## Change Rationale
[Why this change is needed]

## Alternative Solutions
[If any, list at least one alternative and reason for not selecting it]

## Approval Process
| Step | Approver | Status |
|------|----------|--------|
| 1. Document draft | TBD | [ ] |
| 2. ADR review (if applicable) | TBD | [ ] |
| 3. Code review | TBD | [ ] |
| 4. Integration test | CI | [ ] |
| 5. Approver sign-off | TBD | [ ] |

## Related Links
- Related ADRs:
- Related contracts:
- Related issues/PRs:
```

## 6. Approval Role Definitions

| Role | Responsibility | Applicable Changes |
|------|----------------|-------------------|
| Architect | Approve main architecture boundary changes | §4-§9 Platform infrastructure layer |
| Technical Lead | Approve contract field changes | All contract files |
| Operations Lead | Approve operations process changes | `docs_zh/operations/` |
| Security Review | Approve high-risk new capabilities | New features with security impact |

## 7. Toolchain References

- **Document Tracking**: Manage change requests via GitHub PR / Issues
- **ADR Management**: [`docs_zh/adr/README.md`](../adr/README.md)
- **Contract Registry**: [`docs_zh/contracts/README.md`](../contracts/README.md)
- **Architecture Index**: [`docs_zh/architecture/README.md`](../architecture/README.md)
- **Status Tracking**: Review documents under [`docs_zh/reviews/`](../reviews/)