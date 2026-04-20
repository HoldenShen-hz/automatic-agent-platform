# Change Control

## 1. Goal

Define minimum governance process for document and design changes, avoid coding before drafts are finalized.

## 2. Scope

Applies to:

- Adding new core contracts.
- Modifying main architecture boundaries.
- Adjusting phase scope.
- Introducing high-risk new capabilities.

## 3. Minimum Process

1. First update main documents or contracts.
2. If trade-offs involved, supplement ADR.
3. If affecting current implementation sequence, update operations.
4. If affecting current judgments, update reviews.

## 4. Pre-Coding Requirements

- If contract is not stable, should not directly write corresponding core code.
- If P0 document gaps still clearly exist in reviews, should prioritize supplementing documents.
