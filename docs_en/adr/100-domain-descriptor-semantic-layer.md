# ADR-100 Domain Descriptor As Semantic Layer

---

## OAPEFLIR Association

- **Observe**: Domain signals, terminology, risk, and knowledge boundary input
- **Assess**: Domain descriptor completeness and consistency verification
- **Plan**: Drive workflow, prompt, eval with descriptor
- **Execute**: Expose domain capabilities per descriptor
- **Feedback**: Summarize domain performance and governance feedback
- **Learn**: Iterate domain meta-model
- **Improve**: Optimize descriptor completeness
- **Release**: Descriptor becomes domain release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Business domains cannot be expressed semantically by directory names or pack names alone; a formal semantic layer is required.

## Decision

- `DomainDescriptor` is the authoritative semantic layer for business domains
- All workflow, tool bundle, prompt library, and risk/eval must reference back to descriptor

## Consequences

- Domain meta-model and domain registry master chain have a unified root object
