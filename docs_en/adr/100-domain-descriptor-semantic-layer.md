# ADR-100 Domain Descriptor As Semantic Layer

---

## OAPEFLIR Mapping

- **Observe**: Inputs from domain signals, terminology, risk and knowledge boundaries
- **Assess**: Validate completeness and consistency of the domain descriptor
- **Plan**: Drive workflow, prompt and eval from the descriptor
- **Execute**: Expose domain capabilities per the descriptor
- **Feedback**: Aggregate domain performance and governance feedback
- **Learn**: Iterate the domain meta-model
- **Improve**: Optimize descriptor completeness
- **Release**: Descriptor becomes the domain promotion gate

---

- Status: Accepted
- Decision date: 2026-04-23

## Background

A business domain cannot be expressed semantically only by its directory or pack name; it requires a formal semantic layer.

## Decision

- `DomainDescriptor` is the authoritative semantic layer for business domains
- All workflows, tool bundles, prompt libraries, and risk/eval artifacts must hook back to the descriptor

## Consequences

- The domain meta-model and the domain registration main chain have a unified root object
