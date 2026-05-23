# Architecture Decision Records (ADR)

> This directory contains Architecture Decision Records (ADR) for the project. Each ADR records the background, considerations, and conclusions of important technical decisions.
> `docs_zh/adr/README.md` and `docs_en/adr/README.md` must keep numbers, status, and dates synchronized; if body translation is delayed, record according to `docs_zh/reference/docs-sync.md`.

## ADR Index

| Number | Title | Status | Decision Date |
|------|------|------|----------|
| [001](./001-three-layer-architecture.md) | Three-Layer Decentralized Architecture | Accepted | 2026-04-02 |
| [002](./002-division-system.md) | Division System | Accepted | 2026-04-02 |
| [003A](./003-memory-six-layers.md) | Six-Layer Memory Model and KV Cache Fixed Prefix | Superseded by ADR-020 | 2026-04-02 |
| [003B](./003-memory-seven-layers.md) | Seven-Layer Memory Model (Historical Alias / Jump Page) | Superseded by ADR-020 | 2026-04-02 |
| [004](./004-workflow-routing.md) | Workflow and Routing | Accepted | 2026-04-02 |
| [005](./005-security-model.md) | Security Model | Accepted | 2026-04-02 |
| [006](./006-llm-provider-strategy.md) | LLM Provider Strategy | Accepted | 2026-04-02 |
| [007](./007-evolution-engine.md) | Evolution Engine | Partially Superseded by ADR-075 | 2026-04-02 |
| [008](./008-cost-model.md) | Cost Model | Accepted | 2026-04-02 |
| [009](./009-deployment-ops.md) | Deployment and Operations | Accepted | 2026-04-02 |
| [010](./010-commercial-model.md) | Commercial Model | Accepted | 2026-04-02 |
| [011](./011-effect-ts-adoption.md) | Whether Effect-TS is Used as Core Runtime Foundation | Accepted | 2026-04-03 |
| [012](./012-sqlite-phase-1-2-primary-store.md) | Whether SQLite is Used as Phase 1-2 Sole Primary Storage | Accepted | 2026-04-03 |
| [013](./013-eventemitter-phase-2-boundary.md) | Whether EventEmitter Continues to be Used to Phase 2 | Accepted | 2026-04-03 |
| [014](./014-org-model-code-boundary.md) | Whether Organization Model Directly Maps to Code Objects | Accepted | 2026-04-03 |
| [015](./015-unified-extension-marketplace.md) | Whether Skills and Plugins Converge to Single Marketplace | Accepted | 2026-04-03 |
| [016](./016-oapeflir-loop-model.md) | OAPEFLIR Eight-Stage Cognitive Loop Model | Accepted | 2026-04-17 |
| [017](./017-knowledge-architecture-refactor.md) | Knowledge Three-Index Architecture Refactor | Accepted | 2026-04-17 |
| [018](./018-rollout-eleven-state-machine.md) | Rollout Eleven-State State Machine and Six-Phase Release | Superseded by ADR-075 | 2026-04-17 |
| [019](./019-agent-handoff-four-layer-protocol.md) | Agent Handoff Four-Layer Serialization Protocol | Accepted | 2026-04-17 |
| [020](./020-memory-six-plane-model.md) | Memory Six-Plane Model and Automatic Promotion Rules | Accepted | 2026-04-17 |
| [021](./021-inter-plane-communication-contract.md) | Inter-Plane Communication Contract | Accepted | 2026-04-03 |
| [022](./022-api-contract-and-versioning.md) | API Contract and Versioning Architecture | Accepted | 2026-04-03 |
| [023](./023-service-communication-architecture.md) | Service Communication Architecture | Accepted | 2026-04-03 |
| [024](./024-scalability-architecture.md) | Scalability Architecture | Accepted | 2026-04-03 |
| [025](./025-stability-architecture-seven-layers.md) | Stability Architecture | Accepted | 2026-04-03 |
| [026](./026-risk-control-architecture.md) | Risk Control Architecture | Accepted | 2026-04-03 |
| [027](./027-security-architecture.md) | Security and Reliability Architecture | Accepted | 2026-04-03 |
| [028](./028-incident-and-event-handling-architecture.md) | Incident and Event Handling Architecture | Accepted | 2026-04-03 |
| [029](./029-oapeflir-controlled-cognition-kernel.md) | OAPEFLIR Controlled Cognition Kernel | Accepted | 2026-04-17 |
| [030](./030-runtime-execution-plane.md) | Runtime Execution Plane | Accepted | 2026-04-03 |
| [031](./031-disaster-recovery-and-high-availability.md) | Disaster Recovery and High Availability Architecture | Accepted | 2026-04-03 |
| [032](./032-deployment-architecture.md) | Deployment Architecture | Accepted | 2026-04-03 |
| [033](./033-phased-roadmap.md) | Phased Roadmap | Accepted | 2026-04-17 |
| [034](./034-adr-freeze-recommendation.md) | ADR Freeze Recommendation | Accepted | 2026-04-17 |
| [035](./035-recommended-code-directory-structure.md) | Recommended Code Directory | Accepted | 2026-04-17 |
| [036](./036-risk-constraints-and-success-criteria.md) | Risk, Constraints, and Success Criteria | Accepted | 2026-04-17 |
| [037](./037-domain-modeling-and-onboarding.md) | Business Domain Modeling and Onboarding Architecture | Accepted | 2026-04-20 |
| [038](./038-business-domain-onboarding-runbook.md) | Business Domain Onboarding Runbook | Accepted | 2026-04-20 |
| [039](./039-natural-language-task-entry.md) | Natural Language Task Entry Architecture | Accepted | 2026-04-20 |
| [040](./040-goal-decomposition-engine.md) | Goal Decomposition Engine Architecture | Accepted | 2026-04-20 |
| [041](./041-proactive-agent-framework.md) | Proactive Agent Framework | Accepted | 2026-04-20 |
| [042](./042-progressive-autonomy-model.md) | Progressive Autonomy Model | Accepted | 2026-04-20 |
| [043](./043-unified-operations-dashboard.md) | Unified Operations Dashboard | Accepted | 2026-04-20 |
| [044](./044-non-technical-user-experience.md) | Non-Technical User Experience Architecture | Accepted | 2026-04-20 |
| [046](./046-organization-hierarchy-model.md) | Organization Hierarchy Model | Accepted | 2026-04-20 |
| [047](./047-organization-approval-routing.md) | Organization Architecture Approval Routing | Accepted | 2026-04-20 |
| [048](./048-enterprise-sso-scim-integration.md) | Enterprise SSO/SCIM Integration Architecture | Accepted | 2026-04-20 |
| [049](./049-department-compliance-policy-engine.md) | Department Compliance Policy Engine | Accepted | 2026-04-20 |
| [050](./050-knowledge-domain-isolation.md) | Knowledge Domain Isolation and Controlled Sharing | Accepted | 2026-04-20 |
| [051](./051-tiered-governance-delegation.md) | Tiered Governance Delegation | Accepted | 2026-04-20 |
| [052](./052-multi-region-deployment-architecture.md) | Multi-Region Deployment Architecture | Accepted | 2026-04-20 |
| [053](./053-scaling-resource-competition-management.md) | Scaled Resource Competition Management | Accepted | 2026-04-20 |
| [054](./054-sla-tiered-guarantees.md) | SLA Tiered Guarantees | Accepted | 2026-04-20 |
| [055](./055-agent-marketplace-and-ecosystem.md) | Agent Marketplace and Ecosystem | Accepted | 2026-04-20 |
| [056](./056-feedback-driven-continuous-improvement.md) | Feedback-Driven Continuous Improvement Pipeline | Accepted | 2026-04-20 |
| [057](./057-external-system-integration-framework.md) | External System Integration Framework | Accepted | 2026-04-20 |
| [058](./058-emergency-stop-and-global-circuit-breaker.md) | Emergency Stop and Global Circuit Breaker Architecture | Accepted | 2026-04-20 |
| [059](./059-agent-explainability-and-decision-transparency.md) | Agent Explainability and Decision Transparency | Accepted | 2026-04-20 |
| [060](./060-explicit-planning-hub.md) | Explicit Planning Layer and Plan Hub | Accepted | 2026-04-17 |
| [061](./061-agent-unified-lifecycle-management.md) | Agent Unified Lifecycle Management Architecture | Accepted | 2026-04-20 |
| [062](./062-offline-and-edge-deployment-architecture.md) | Offline and Edge Deployment Architecture | Accepted | 2026-04-20 |
| [063](./063-agent-behavior-drift-detection.md) | Agent Behavior Drift Detection Architecture | Accepted | 2026-04-20 |
| [064](./064-cost-attribution-and-optimization-engine.md) | Cost Attribution and Optimization Engine | Accepted | 2026-04-20 |
| [065](./065-workflow-visual-debugger.md) | Workflow Visual Debugger Architecture | Accepted | 2026-04-20 |
| [066](./066-compliance-report-auto-generation.md) | Compliance Report Auto-Generation Engine | Accepted | 2026-04-20 |
| [071](./071-plugin-spi-framework.md) | Plugin SPI Interface System and Lifecycle | Accepted | 2026-04-17 |
| [067](./067-capacity-planning-and-cost-prediction.md) | Capacity Planning and Cost Prediction Engine | Accepted | 2026-04-20 |
| [068](./068-multimodal-capability-architecture.md) | Multimodal Capability Architecture | Accepted | 2026-04-20 |
| [069](./069-platform-self-operating-agent.md) | Platform Self-Operating Agent Architecture | Partially Superseded | 2026-04-20 |
| [070](./070-conclusion.md) | Conclusion | Superseded by ADR-109 to ADR-113 | 2026-04-20 |
| [072](./072-oapeflir-testing-strategy.md) | OAPEFLIR Testing Strategy and New Module Testing Matrix | Partially Superseded | 2026-04-17 |
| [073](./073-unified-resource-model.md) | ADR-073: Unified Agent Resource Model | Accepted | 2026-04-13 |
| [075](./075-controlled-rollout-release.md) | Six-Level Controlled Release and Rollout State Machine | Accepted | 2026-04-17 |
| [078](./078-knowledge-plane-architecture.md) | Knowledge Plane Architecture and Trust Model | Partially Superseded | 2026-04-17 |
| [079](./079-feedback-hub-signals.md) | Feedback Hub and Seven-Type Signal Preprocessing | Accepted | 2026-04-17 |
| [080](./080-learn-hub-pattern-detection.md) | Learn Hub and Four-Pattern Detector | Accepted | 2026-04-17 |
| [081](./081-domain-descriptor-and-onboarding.md) | Domain Descriptor And Onboarding | Accepted | 2026-04-20 |
| [082](./082-natural-language-entry-and-goal-decomposition.md) | Natural Language Entry And Goal Decomposition | Accepted | 2026-04-20 |
| [083](./083-proactive-agent-and-progressive-autonomy.md) | Proactive Agent And Progressive Autonomy | Accepted | 2026-04-20 |
| [084](./084-operator-dashboard-and-user-experience.md) | Operator Dashboard And User Experience | Accepted | 2026-04-20 |
| [085](./085-organization-governance-and-knowledge-boundary.md) | Organization Governance And Knowledge Boundary | Accepted | 2026-04-20 |
| [086](./086-scale-ecosystem-and-cross-region-runtime.md) | Scale Ecosystem And Cross Region Runtime | Accepted | 2026-04-20 |
| [087](./087-ops-maturity-runtime.md) | Ops Maturity Runtime | Accepted | 2026-04-20 |
| [088](./088-platform-surface-communication-and-extensibility.md) | ADR 088: Platform Surface, Communication, and Extensibility | Accepted | 2026-04-20 |
| [089](./089-ai-operations-governance-and-quality.md) | ADR 089: AI Operations Governance and Quality | Accepted | 2026-04-20 |
| [090](./090-runtime-data-reliability-and-operations.md) | ADR 090: Runtime, Data Reliability, and Operations | Accepted | 2026-04-20 |
| [091](./091-harness-eight-pillar-model.md) | Harness Eight Pillar Model | Accepted | 2026-04-23 |
| [092](./092-harness-loop-controller.md) | Harness Loop Controller | Accepted | 2026-04-23 |
| [093](./093-harness-constraint-engine.md) | Harness Constraint Engine | Accepted | 2026-04-23 |
| [094](./094-harness-durable-execution.md) | Harness Durable Execution | Accepted | 2026-04-23 |
| [095](./095-harness-context-assembly.md) | Harness Context Assembly | Accepted | 2026-04-23 |
| [096](./096-harness-recovery-controller.md) | Harness Recovery Controller | Accepted | 2026-04-23 |
| [097](./097-harness-guardrails.md) | Harness Guardrails | Accepted | 2026-04-23 |
| [098](./098-harness-hitl-runtime.md) | Harness HITL Runtime | Accepted | 2026-04-23 |
| [099](./099-harness-async-mode.md) | Harness Async Mode | Accepted | 2026-04-23 |
| [100](./100-domain-descriptor-semantic-layer.md) | Domain Descriptor As Semantic Layer | Accepted | 2026-04-23 |
| [101](./101-domain-risk-override-platform-default.md) | Domain Risk Override Over Platform Default | Accepted | 2026-04-23 |
| [102](./102-domain-recipe-onboarding-accelerator.md) | Domain Recipe As Onboarding Accelerator | Accepted | 2026-04-23 |
| [103](./103-four-phase-domain-onboarding.md) | Four Phase Domain Onboarding | Accepted | 2026-04-23 |
| [104](./104-domain-recipe-twelve-archetypes.md) | Domain Recipe Twelve Archetypes | Accepted | 2026-04-23 |
| [105](./105-domain-latency-tier-classification.md) | Domain Latency Tier Classification | Accepted | 2026-04-23 |
| [106](./106-quant-trading-pre-trade-risk-mandatory.md) | Quant Trading Pre Trade Risk Mandatory | Accepted | 2026-04-23 |
| [107](./107-financial-services-explainable-decisions.md) | Financial Services Explainable Decisions | Accepted | 2026-04-23 |
| [108](./108-legal-output-attorney-review-mandatory.md) | Legal Output Attorney Review Mandatory | Accepted | 2026-04-23 |
| [109](./109-contract-freeze.md) | v4.3 Contract Freeze | Accepted | 2026-04-27 |
| [110](./110-runtime-state-machine-authority.md) | Runtime State Machine Authority | Accepted | 2026-04-27 |
| [111](./111-platform-fact-vs-oapeflir-view-events.md) | Platform Fact vs OAPEFLIR View Events | Accepted | 2026-04-27 |
| [112](./112-mvp-ring-implementation-boundary.md) | MVP Ring Implementation Boundary | Accepted | 2026-04-27 |

## Status Description

- **Draft**: Under discussion, decision not yet made
- **Proposed**: Proposed, waiting for approval
- **Accepted**: Accepted and implemented
- **Superseded**: Superseded by new ADR
- **Deprecated**: Deprecated

## Notes

- Historical directory simultaneously retains `003-memory-six-layers.md` and `003-memory-seven-layers.md`; where `seven-layers` is retained only as historical alias / jump page, and canonical content uses `003-memory-six-layers.md` as the standard.
- Plugin SPI ADR has been unified and converged to `071-plugin-spi-framework.md`; the old `066-plugin-spi-framework.md` duplicate copy has been removed, and all references are unified to ADR-071.
- Newly added `091-108` are used to承接 Harness eight pillars and domain governance supplement items.
- Newly added `109-112` are v4.3 Contract Freeze implementation entry points: freezing 12 canonical contracts, state machine sole authority, `platform.*` and `oapeflir.view.*` event hierarchy, and MVP / Hardening / Enterprise three-ring boundary.
- `109-112` constrain old `ExecutionPlan` / `ExecutionReceipt` / `ControlDirective` / `StateCommand` / OAPEFLIR runtime authority / Phase naming through freeze / authority / event namespace / ring boundary; historical ADR text is retained and not directly rewritten.

## Creating New ADR

New ADR should follow standard template; numbering retains number blocks by batch and evolution stage, and does not force fill historical gaps. See [../governance/source_of_truth.md](../governance/source_of_truth.md) for details.
