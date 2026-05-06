# ADR-032 Deployment Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform needs to support multi-environment deployment (dev/test/staging/pre-prod/prod) and different deployment scales.

## Decision

### Deployment Stages

| Stage | Description |
|-------|-------------|
| D1 Monolithic | ≤10 concurrency, current default configuration |
| D2 Multi-process | 10-100 concurrency |
| D3 Distributed | 100-1000 concurrency |
| D4 K8s Cluster | 5000+ concurrency |

### 5 Environments

| Environment | Purpose |
|------------|---------|
| dev | Development |
| test | Unit/Integration Testing |
| staging | Pre-release Testing |
| pre-prod | Pre-production Validation |
| prod | Production |

### Worker Pool Isolation

- worker-pool/ supports capability category isolation
- Different task types use different Worker pools
- Prevents resource contention

### Deployment Methods

- Helm values manage K8s configuration
- Terraform tfvars manage infrastructure configuration

## Consequences

Pros:

- Multi-environment separation facilitates testing and release
- Worker pool isolation improves stability
- IaC approach facilitates environment consistency

Cons:

- Multi-environment increases operational complexity
- Deployment process needs standardization

## Cross-references

- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)

## Source Section

- `§32` Deployment Architecture
