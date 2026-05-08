# ADR-095 Harness Context Assembly

---

## OAPEFLIR Association

- **Observe**: Collect task/domain/shared context sources
- **Assess**: Evaluate token budget and sensitive information
- **Plan**: Assemble context block and snapshot granularity
- **Execute**: Provide context input for Harness step
- **Feedback**: Record context missing and compression results
- **Learn**: Identify most valuable context sources
- **Improve**: Optimize compression and namespace strategy
- **Release**: Incorporate context quality into runtime acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Without a unified assembler, Harness will repeatedly concatenate across different call paths, cannot be audited, and cannot compress or replay.

## Decisions

- `ContextAssembler` serves as Harness's authoritative context assembly entry point
- Must support task / domain / shared source set
- Each loop generates `ContextSnapshot`

## Consequences

- Context assembly becomes a testable, recoverable, governable formal capability
