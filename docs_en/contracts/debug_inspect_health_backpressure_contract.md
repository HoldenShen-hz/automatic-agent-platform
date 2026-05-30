# Debug Inspect Health Backpressure Contract

## Purpose

Define the minimum contract baseline for debugging, inspection, health, and backpressure, constraining the output specifications for logs, health signals, inspection results, and backpressure alerts.

## Authoritative Implementations

- `src/platform/shared/observability/`
- `src/platform/five-plane-control-plane/incident-control/`
- `src/platform/five-plane-interface/channel-gateway/`

## Core Constraints

- Health and backpressure signals should output observable events, structured logs, or explicit status results, and must not silently swallow errors.
- inspect/debug output belongs to the operations view and must not be disguised as business truth.
- Alert thresholds can be configured, but in default cases must be fail-closed, rather than treating missing metrics as healthy.

## Description

- This document defines a contract baseline and does not freeze all Prometheus metric names.
- Specific metrics, log fields, and event names are subject to the schema and exporter in the corresponding implementation.