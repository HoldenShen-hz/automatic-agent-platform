# Architecture Decision Records (ADR)

> This directory contains the project's Architecture Decision Records (ADR). Each ADR records the background, considerations, and conclusions of an important technical decision.

## ADR Index

| Number | Title | Status | Decision Date |
|--------|-------|--------|---------------|
| [001](./001-three-layer-architecture.md) | Three-Layer Distributed Architecture | Accepted | 2026-04-02 |
| [002](./002-division-system.md) | Division System | Accepted | 2026-04-02 |
| [003](./003-memory-seven-layers.md) | Six-Layer Memory and KV Cache Fixed Prefix | Accepted | 2026-04-02 |
| [004](./004-workflow-routing.md) | Workflow and Routing | Accepted | 2026-04-02 |
| [005](./005-security-model.md) | Security Model | Accepted | 2026-04-02 |
| [006](./006-llm-provider-strategy.md) | LLM Provider Strategy | Accepted | 2026-04-02 |
| [007](./007-evolution-engine.md) | Evolution Engine | Accepted | 2026-04-02 |
| [008](./008-cost-model.md) | Cost Model | Accepted | 2026-04-02 |
| [009](./009-deployment-ops.md) | Deployment and Operations | Accepted | 2026-04-02 |
| [010](./010-commercial-model.md) | Commercial Model | Accepted | 2026-04-02 |
| [011](./011-effect-ts-adoption.md) | Whether Effect-TS as Core Runtime Foundation | Accepted | 2026-04-03 |
| [012](./012-sqlite-phase-1-2-primary-store.md) | Whether SQLite as Phase 1-2 Only Primary Storage | Accepted | 2026-04-03 |
| [013](./013-eventemitter-phase-2-boundary.md) | Whether EventEmitter Continues to Phase 2 | Accepted | 2026-04-03 |
| [014](./014-org-model-code-boundary.md) | Whether Organization Model Directly Maps to Code Objects | Accepted | 2026-04-03 |
| [015](./015-unified-extension-marketplace.md) | Whether Skill and Plugin Converge to Single Marketplace | Accepted | 2026-04-03 |
| [016](./016-oapeflir-loop-model.md) | OAPEFLIR Eight-Phase Cognitive Loop Model | Accepted | 2026-04-17 |
| [017](./017-knowledge-architecture-refactor.md) | Knowledge Three-Index Architecture Refactor | Accepted | 2026-04-17 |
| [018](./018-rollout-eleven-state-machine.md) | Rollout Eleven-State Machine and Six-Phase Release | Accepted | 2026-04-17 |
| [019](./019-agent-handoff-four-layer-protocol.md) | Agent Handoff Four-Layer Serialization Protocol | Accepted | 2026-04-17 |
| [020](./020-memory-six-plane-model.md) | Memory Six-Layer Plane and Auto-Promotion Rules | Accepted | 2026-04-17 |
| [021](./021-inter-plane-communication-contract.md) | Inter-Plane Communication Contract | Accepted | 2026-04-03 |
| [022](./022-api-contract-and-versioning.md) | API Contract and Versioning | Accepted | 2026-04-03 |
| [023](./023-service-communication-architecture.md) | Service Communication Architecture | Accepted | 2026-04-03 |
| [024](./024-scalability-architecture.md) | Scalability Architecture | Accepted | 2026-04-03 |
| [025](./025-stability-architecture-seven-layers.md) | Stability Architecture (Seven Layers) | Accepted | 2026-04-03 |
| [026](./026-risk-control-architecture.md) | Risk Control Architecture | Accepted | 2026-04-03 |
| [027](./027-security-architecture.md) | Security Architecture | Accepted | 2026-04-03 |
| [028](./028-incident-and-event-handling-architecture.md) | Incident and Event Handling Architecture | Accepted | 2026-04-03 |
| [029](./029-oapeflir-controlled-cognition-kernel.md) | OAPEFLIR Controlled Cognition Kernel | Accepted | 2026-04-17 |
| [030](./030-runtime-execution-plane.md) | Runtime Execution Plane | Accepted | 2026-04-03 |
| [031](./031-disaster-recovery-and-high-availability.md) | Disaster Recovery and High Availability | Accepted | 2026-04-03 |
| [032](./032-deployment-architecture.md) | Deployment Architecture | Accepted | 2026-04-03 |
| [033](./033-phased-roadmap.md) | Phased Roadmap | Accepted | 2026-04-17 |
| [034](./034-adr-freeze-recommendation.md) | ADR Freeze Recommendation | Accepted | 2026-04-17 |
| [035](./035-recommended-code-directory-structure.md) | Recommended Code Directory Structure | Accepted | 2026-04-17 |
| [036](./036-risk-constraints-and-success-criteria.md) | Risk, Constraints, and Success Criteria | Accepted | 2026-04-17 |
| [037](./037-domain-modeling-and-onboarding.md) | Domain Modeling and Onboarding Architecture | Accepted | 2026-04-20 |
| [038](./038-business-domain-onboarding-runbook.md) | Business Domain Onboarding Runbook | Accepted | 2026-04-20 |
| [039](./039-natural-language-task-entry.md) | Natural Language Task Entry Architecture | Accepted | 2026-04-20 |
| [040](./040-goal-decomposition-engine.md) | Goal Decomposition Engine Architecture | Accepted | 2026-04-20 |
| [041](./041-proactive-agent-framework.md) | Proactive Agent Framework | Accepted | 2026-04-20 |
| [042](./042-progressive-autonomy-model.md) | Progressive Autonomy Model | Accepted | 2026-04-20 |
| [043](./043-unified-operations-dashboard.md) | Unified Operations Dashboard | Accepted | 2026-04-20 |
| [044](./044-non-technical-user-experience.md) | Non-Technical User Experience | Accepted | 2026-04-20 |
| [046](./046-organization-hierarchy-model.md) | Organization Hierarchy Model | Accepted | 2026-04-20 |
| [047](./047-organization-approval-routing.md) | Organization Approval Routing | Accepted | 2026-04-20 |
| [048](./048-enterprise-sso-scim-integration.md) | Enterprise SSO/SCIM Integration Architecture | Accepted | 2026-04-20 |
| [049](./049-department-compliance-policy-engine.md) | Department Compliance Policy Engine | Accepted | 2026-04-20 |
| [050](./050-knowledge-domain-isolation.md) | Knowledge Domain Isolation and Controlled Sharing | Accepted | 2026-04-20 |
| [051](./051-tiered-governance-delegation.md) | Tiered Governance Delegation | Accepted | 2026-04-20 |
| [052](./052-multi-region-deployment-architecture.md) | Multi-Region Deployment Architecture | Accepted | 2026-04-20 |
| [053](./053-scaling-resource-competition-management.md) | Scaling Resource Competition Management | Accepted | 2026-04-20 |
| [054](./054-sla-tiered-guarantees.md) | SLA Tiered Guarantees | Accepted | 2026-04-20 |
| [055](./055-agent-marketplace-and-ecosystem.md) | Agent Marketplace and Ecosystem | Accepted | 2026-04-20 |
| [056](./056-feedback-driven-continuous-improvement.md) | Feedback-Driven Continuous Improvement | Accepted | 2026-04-20 |
| [057](./057-external-system-integration-framework.md) | External System Integration Framework | Accepted | 2026-04-20 |
| [058](./058-emergency-stop-and-global-circuit-breaker.md) | Emergency Stop and Global Circuit Breaker | Accepted | 2026-04-20 |
| [059](./059-agent-explainability-and-decision-transparency.md) | Agent Explainability and Decision Transparency | Accepted | 2026-04-20 |

## Status Description

- **Draft**: Under discussion, decision not yet made
- **Proposed**: Submitted, waiting for approval
- **Accepted**: Accepted and implemented
- **Superseded**: Superseded by new ADR
- **Deprecated**: Deprecated

## Creating New ADR

New ADR should follow standard template, numbering sequentially. For details refer to [../governance/source_of_truth.md](../governance/source_of_truth.md).
