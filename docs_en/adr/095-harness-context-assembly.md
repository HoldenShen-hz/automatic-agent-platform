# ADR-095: Harness Context Assembly

---

## OAPEFLIR Association

- **Observe**: Collect task/domain/shared context sources
- **Assess**: Evaluate token budget and sensitive information
- **Plan**: Assemble context block and snapshot granularity
- **Execute**: Provide context input for Harness node execution
- **Feedback**: Record context missing and compression results
- **Learn**: Identify most valuable context sources
- **Improve**: Optimize compression and namespace strategy
- **Release**: Include context quality in runtime acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

If context does not have a unified assembler, Harness will repeatedly splice across different call paths, cannot audit, and cannot compress and replay.

## Decision

- `ContextAssembler` serves as the Harness authoritative context assembly entry
- Must support task / domain / shared source set
- Each loop generates `ContextSnapshot`

## Consequences

- Context assembly becomes a testable, recoverable, governable formal capability