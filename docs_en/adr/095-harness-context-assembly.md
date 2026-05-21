# ADR-095: Harness Context Assembly

---

## OAPEFLIR Relationship

- **Observe**: Collect task/domain/shared context sources
- **Assess**: Evaluate token budget and sensitive information
- **Plan**: Assemble context block and snapshot granularity
- **Execute**: Provide context input for `NodeRun / NodeAttempt`
- **Feedback**: Record context missing and compression results
- **Learn**: Identify most valuable context sources
- **Improve**: Optimize compression and namespace strategy
- **Release**: Put context quality into runtime acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

If context does not have a unified assembler, Harness will redundantly splice across different call paths, cannot be audited, cannot compress or replay.

## Decision

- `ContextAssembler` serves as the authoritative context assembly entry point for Harness
- Each context assembly must carry `NodeRun` level scope / audit ref to avoid task-level包裹 distortion
- Must support task / domain / shared source set
- Each loop iteration generates `ContextSnapshot`

## Consequences

- Context assembly becomes a testable, recoverable, governable formal capability