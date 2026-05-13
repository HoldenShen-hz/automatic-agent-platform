# ADR-032 Deployment Architecture

- Status: Accepted
- Decision Date: 2026-04-03

## Context

The platform needs to support multi-environment deployment (dev/test/staging/pre-prod/prod) and support different deployment scales.

## Decision

### Deployment Stages

| Stage | Description |
|-------|-------------|
| D1 Monolithic | ≤10 concurrent, current default config |
| D2 Multi-process | 10-100 concurrent |
| D3 Distributed | 100-1000 concurrent |
| D4 K8s Cluster | 5000+ concurrent |

### 5 Environments

| Environment | Purpose |
|-------------|---------|
| dev | Development environment |
| test | Unit/Integration testing |
| staging | Pre-release testing |
| pre-prod | Pre-production validation |
| prod | Production environment |

### Worker Pool Isolation

- worker-pool/ supports capability category isolation
- Different types of tasks use different Worker pools
- Prevents resource contention

### Deployment Methods

- Helm values manage K8s configuration
- Terraform tfvars manage infrastructure configuration

## Consequences

Benefits:

- Multi-environment separation facilitates testing and release
- Worker pool isolation improves stability
- IaC approach facilitates environment consistency

Trade-offs:

- Multi-environment increases operational complexity
- Deployment process requires standardization

## Cross-references

- [ADR-009 Deployment and Operations](./009-deployment-ops.md)
- [ADR-024 Scalability Architecture](./024-scalability-architecture.md)

## Source Section

- `§32` Deployment Architecture