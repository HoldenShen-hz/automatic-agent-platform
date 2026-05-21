# ADR-100: Domain Descriptor As Semantic Layer

---

## OAPEFLIR Relationship

- **Observe**: Domain signals, terminology, risk, and knowledge boundary input
- **Assess**: Domain descriptor completeness and consistency validation
- **Plan**: Drive workflow, prompt, eval with descriptor
- **Execute**: Expose domain capabilities per descriptor
- **Feedback**: Aggregate domain performance and governance feedback
- **Learn**: Iterate domain meta-model
- **Improve**: Optimize descriptor completeness
- **Release**: descriptor becomes domain release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Business domains cannot rely solely on directory names or pack names to express semantics; there must be a formal semantic layer.

## Decision

- `DomainDescriptor` is the authoritative semantic layer for business domains
- All workflow, tool bundle, prompt library, risk/eval must trace back to descriptor

## Consequences

- Domain meta-model and domain registry main chain have a unified root object