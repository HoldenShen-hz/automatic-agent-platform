# ADR-122 Domain Evidence and Session Replay Boundary

- Status: Accepted
- Decision Date: 2026-05-25

## Background

Domain registry, knowledge namespace, checkpoint envelope, and session JSONL replay all exist, but their authority boundaries were not clearly written before, causing reviews to mix evidence responsibilities from different layers.

## Decision

### 1. Session Replay Responsibilities

- `SessionDualStorageService`'s authoritative responsibility is preserving session timeline and interaction events.
- Session replay is not the domain lifecycle audit bus, nor is it the knowledge namespace policy engine.
- Domain lifecycle event authoritative source is still the structured events published by domain registry.

### 2. Checkpoint Domain Affiliation

- Checkpoint envelope can carry `domainId` / `namespaceId`, used for retention, routing, governance attribution.
- But checkpoint payload schema authority is still determined by payload schema / envelope schema contract.
- Domain meta model is not responsible for replacing payload schema version validation.

### 3. Knowledge Namespace and Session Relationship

- Domain registry is responsible for declaring which knowledge namespaces a domain allows.
- Session replay by default does not re-execute namespace policy judgment on historical messages.
- If domain-aware replay/inspection is needed, it should be done through upper-layer inspect/governance view combining session timeline with domain registry / checkpoint metadata, rather than stuffing all domain events into session JSONL.

## Results

- Session chronology, domain lifecycle, checkpoint schema, knowledge namespace each retain single authority.
- If cross-layer inspect views are added later, should go through compositional queries, not let a single storage bear all governance responsibilities.