# ADR-095 Harness Context Assembly

---

## OAPEFLIR Association

- **Observe**: Collect task/domain/shared context sources
- **Assess**: Evaluate token budget and sensitive information
- **Plan**: Assemble context block and snapshot granularity
- **Execute**: Provide context input for `NodeRun / NodeAttempt`
- **Feedback**: Record context missing and compression results
- **Learn**: Identify most valuable context sources
- **Improve**: Optimize compression and namespace strategy
- **Release**: Include context quality in runtime acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

If context does not have a unified assembler, Harness will repeatedly splice across different call paths, cannot be audited, and cannot compress or replay.

## Decision

- `ContextAssembler` serves as Harness's authoritative context assembly entry
- Each context assembly must carry `NodeRun`-level scope / audit ref to avoid task-level large包裹 distortion
- Must support task / domain / shared source set
- Each loop generates `ContextSnapshot`

## Consequences

- Context assembly becomes a testable, recoverable, governable formal capability
