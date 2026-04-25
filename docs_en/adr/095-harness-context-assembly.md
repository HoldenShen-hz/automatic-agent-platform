# ADR-095 Harness Context Assembly

---

## OAPEFLIR Association

- **Observe**: Collect task, domain, and shared context sources
- **Assess**: Evaluate token budget and sensitive content
- **Plan**: Assemble context blocks and snapshot granularity
- **Execute**: Provide step input context
- **Feedback**: Record missing context and compression results
- **Learn**: Identify high-value context sources
- **Improve**: Refine compression and namespace policy
- **Release**: Context quality becomes part of runtime acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Without a unified context assembler, Harness repeats context assembly across different call paths, making it unauditable, uncompressible, and unreplayable.

## Decision

- `ContextAssembler` is the authoritative Harness context assembly entrypoint
- Must support task / domain / shared source sets
- Each loop produces a `ContextSnapshot`

## Consequences

- Context assembly becomes a testable, recoverable, and governable first-class capability