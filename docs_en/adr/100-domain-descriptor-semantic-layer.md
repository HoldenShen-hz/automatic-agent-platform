# ADR-100: Domain Descriptor As Semantic Layer

---

## OAPEFLIR Association

- **Observe**: Domain signals, terminology, risk, and knowledge boundary input
- **Assess**: Domain description completeness and consistency validation
- **Plan**: Drive workflow, prompt, and eval by descriptor
- **Execute**: Expose domain capability by descriptor
- **Feedback**: Summarize domain performance and governance feedback
- **Learn**: Iterate domain meta-model
- **Improve**: Optimize descriptor completeness
- **Release**: Descriptor becomes domain release gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Business domains cannot express semantics merely by directory name or pack name; they must have a formal semantic layer.

## Decision

- `DomainDescriptor` is the business domain authoritative semantic layer
- All workflow, tool bundle, prompt library, and risk/eval must attach back to descriptor

## Consequences

- Domain meta-model and domain registry main chain have a unified root object