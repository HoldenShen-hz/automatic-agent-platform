# ADR-095 Harness Context Assembly

---

## OAPEFLIR Association

- **Observe**: Collect task/domain/shared context sources
- **Assess**: Evaluate token budget and sensitive information
- **Plan**: Assemble context block and snapshot granularity
- **Execute**: Provide context input for Harness NodeRun execution group (note: context is assembled by NodeRun, not step; step is only a semantic projection, NodeRun/NodeAttempt is the execution layer truth)
- **Feedback**: Record context missing and compression results
- **Learn**: Identify most valuable context sources
- **Improve**: Optimize compression and namespace strategy
- **Release**: Incorporate context quality into runtime acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

If there is no unified assembler, Harness will repeatedly concatenate across different call paths, cannot audit, and cannot compress or replay.

## Decision

- `ContextAssembler` serves as the authoritative context assembly entry point for Harness
- Must support task / domain / shared source set
- Each loop generates `ContextSnapshot`

## Consequences

- Context assembly becomes a formal capability that is testable, recoverable, and governable
