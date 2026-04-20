# Change Control

---

## OAPEFLIR Association

This governance document regulates the following within the OAPEFLIR 8-stage cognitive loop:

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

Define the minimum governance process for document and design changes, preventing coding before drafts are finalized.

## 2. Scope

Applies to:

- New core contracts
- Modifying main architecture boundaries
- Adjusting phase scope
- Introducing high-risk new capabilities

## 3. Minimum Process

1. First update the main document or contract.
2. If tradeoffs are involved, add an ADR.
3. If affecting current implementation sequence, update operations.
4. If affecting current judgments, update reviews.

## 4. Pre-Coding Requirements

- If a contract is not stable, corresponding core code should not be written directly.
- If P0 document gaps still clearly exist in reviews, documents should be prioritized.
