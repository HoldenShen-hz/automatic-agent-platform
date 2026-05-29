# ADR-095 Harness Context Assembly

---

## OAPEFLIR Association

- **Observe**: Collect task/domain/shared context sources
- **Assess**: Evaluate token budget and sensitive information
- **Plan**: Assemble context block and snapshot granularity
- **Execute**: Provide context input for `NodeRun / NodeAttempt`
- **Feedback**: Record context missing and compression results
- **Learn**: Identify most valuable context sources
- **Improve**: Optimize compression and namespace strategy
- **Release**: Include context quality in runtime acceptance

---

- Status: Accepted
- Decision Date: 2026-04-23

## Background

Without a unified assembler, Harness will重复拼接 in different call paths, cannot audit, cannot compress and replay.

## Decision

- `ContextAssembler` serves as Harness's authoritative context assembly entry
- Each context assembly must carry `NodeRun`-level scope/audit ref to avoid task-level large package distortion
- Must support task / domain / shared source set
- Each loop round generates `ContextSnapshot`

## Consequences

- Context assembly becomes a testable, recoverable, governable formal capability