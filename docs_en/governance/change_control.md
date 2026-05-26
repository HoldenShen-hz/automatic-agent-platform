# Change Control

---

## OAPEFLIR Association

This governance document standardizes the following content within the OAPEFLIR eight-stage cognitive loop:

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

Define the minimum governance process for document and design changes to avoid starting coding before draft completion.

## 2. Scope

Applies to:

- New core contracts.
- Modifying main architectural boundaries.
- Adjusting phase scope.
- Introducing high-risk new capabilities.

## 3. Minimum Process

1. Update main documents or contracts first.
2. Add ADR if trade-offs are involved.
3. Update operations if affecting current implementation order.
4. Update reviews if affecting current judgments.

## 4. Pre-Coding Requirements

- If a contract is not stable, corresponding core code should not be written directly.
- If P0 document gaps still clearly exist in reviews, documentation should be prioritized.

## 5. Change Request Template

All core contracts, architecture, and main document changes must be formally submitted using the following template:

```markdown
## Change Title
[Short description of change intent]

## Change Type
- [ ] New contract
- [ ] Modify contract
- [ ] Main architectural boundary adjustment
- [ ] Phase scope adjustment
- [ ] High-risk new capability introduction

## Impact Scope
- Affected files/modules:
- Affected systems:
- Rollback complexity (Low/Medium/High):

## Change Rationale
[Why this change is being made]

## Alternatives
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

| Role | Responsibilities | Applicable Changes |
|------|-----------------|-------------------|
| Architect | Approve main architectural boundary changes | §4-§9 Platform infrastructure layer |
| Tech Lead | Approve contract field changes | All contract files |
| Ops Lead | Approve operations process changes | `docs_zh/operations/` |
| Security Review | Approve high-risk new capabilities | New features with security impact |

## 7. Toolchain References

- **Document Tracking**: Managed via GitHub PR / Issues
- **ADR Management**: [`docs_zh/adr/README.md`](../adr/README.md)
- **Contract Registry**: [`docs_zh/contracts/README.md`](../contracts/README.md)
- **Architecture Index**: [`docs_zh/architecture/README.md`](../architecture/README.md)
- **Status Tracking**: Review documents under [`docs_zh/reviews/`](../reviews/)
