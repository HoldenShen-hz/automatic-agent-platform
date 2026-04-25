# ADR-100 Domain Descriptor As Semantic Layer

---

## OAPEFLIR Association

- **Observe**: Domain signals, terminology, risk, and knowledge boundary inputs
- **Assess**: Domain descriptor completeness and consistency validation
- **Plan**: Drive workflow, prompt, and eval from descriptor
- **Execute**: Expose domain capabilities through descriptor
- **Feedback**: Aggregate domain performance and governance feedback
- **Learn**: Iterate domain meta-model
- **Improve**: Optimize descriptor completeness
- **Release**: Descriptor becomes domain launch gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Business domains cannot rely on directory names or pack names to express semantics; they need a formal semantic layer.

## Decision

- `DomainDescriptor` is the authoritative semantic layer for business domains
- All workflows, tool bundles, prompt libraries, and risk/eval must anchor back to the descriptor

## Consequences

- Domain meta-model and domain registry main chain share a unified root object