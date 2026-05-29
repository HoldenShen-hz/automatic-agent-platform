# Implementation Plan

> This document records the current phase boundaries and execution constraints for remediation work.

## 1. Current Phase

- The current source of truth for remediation is `architecture-design-vs-implementation-review.md`.
- The current active execution entry point is [current_todo_list.md](./current_todo_list.md).
- The current development sequence is supplemented by [operations-roadmap.md](./operations-roadmap.md).

## 2. Execution Principles

- Only implement items that can be落地 (implemented), tested, and documented within the repository.
- Each remediation iteration must simultaneously cover code, tests, and documentation.
- External infrastructure-class items only retain descriptions; do not falsely claim they are closed within the repository.

## 3. Phase Completion Criteria

- `review / coverage-matrix / current_todo_list` are aligned.
- Code, tests, and documentation for the corresponding batch are all delivered.
- No known targeted blockers remain.