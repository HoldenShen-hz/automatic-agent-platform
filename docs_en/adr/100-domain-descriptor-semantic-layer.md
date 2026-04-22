# ADR-100 Domain Descriptor As Semantic Layer

---

## OAPEFLIR Association

- **Observe**: Gather domain signals, terminology, risk, and knowledge boundaries
- **Assess**: Validate descriptor completeness and consistency
- **Plan**: Drive workflow, prompt, and eval from descriptor semantics
- **Execute**: Expose domain capabilities through the descriptor
- **Feedback**: Collect domain performance and governance feedback
- **Learn**: Evolve the domain meta-model
- **Improve**: Improve descriptor completeness
- **Release**: Descriptor is a domain launch gate

---

- Status: Accepted
- Decision Date: 2026-04-23

## Context

Business domains cannot rely on directory names or pack names as their semantic model.

## Decision

- `DomainDescriptor` is the authoritative semantic layer for each domain
- Workflows, tool bundles, prompts, and risk/eval all anchor back to it

## Consequences

- Domain meta-model and registry share one root object
