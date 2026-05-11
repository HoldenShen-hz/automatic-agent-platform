# ADR-095 Harness Context Assembly

---

## OAPEFLIR Association

- **Observe**: Collect task/domain/shared context sources
- **Assess**: Evaluate token budget and sensitive information
- **Plan**: Assemble context block and snapshot granularity
- **Execute**: Provide context input for Harness node execution
- **Feedback**: Record context gaps and compression results
- **Learn**: Identify the most valuable context sources
- **Improve**: Optimize compression and namespace strategies
- **Release**: Incorporate context quality into runtime acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Without a unified assembler, Harness would repeatedly concatenate context across different call paths, making it impossible to audit, compress, or replay.

## Decision

- `ContextAssembler` serves as the authoritative context assembly entry point for Harness
- Must support task / domain / shared source sets
- Each loop iteration generates a `ContextSnapshot`

## Consequences

- Context assembly becomes a testable, recoverable, and governable formal capability
