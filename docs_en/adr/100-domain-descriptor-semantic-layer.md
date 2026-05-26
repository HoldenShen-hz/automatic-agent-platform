# ADR-100 Domain Descriptor As Semantic Layer

---

## OAPEFLIR Association

- **Observe**: Domain signals, terminology, risk, and knowledge boundary input
- **Assess**: Domain descriptor completeness and consistency verification
- **Plan**: Drive workflow, prompt, eval by descriptor
- **Execute**: Expose domain capabilities according to descriptor
- **Feedback**: Summarize domain performance and governance feedback
- **Learn**: Iterate domain meta model
- **Improve**: Optimize descriptor completeness
- **Release**: Descriptor becomes domain release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Business domains cannot express semantics relying only on directory names or pack names, must have a formal semantic layer.

## Decision

- `DomainDescriptor` is the business domain authoritative semantic layer
- All workflow, tool bundle, prompt library, risk/eval must attach back to descriptor

## Consequences

- Domain meta model and domain registry main chain have unified root object
