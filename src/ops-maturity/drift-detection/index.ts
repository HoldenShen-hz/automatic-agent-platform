/**
 * Behavior Drift Detection Module
 *
 * Provides behavior fingerprinting, changepoint detection, evidence collection,
 * and rollout guardrails for agent drift management.
 *
 * R13-12: Directory structure per §35 recommendation - learning/improvement
 * subdirectory contains the learning pipeline components.
 */

// Core MVP service (existing)
export * from './evolution-mvp-service.js';

// Learning pipeline components (R13-12: reorganized into learning/ subdirectory)
export * from './learning/evidence-store.js';
export * from './learning/reflection-engine.js';
export * from './learning/proposal-engine.js';
export * from './learning/benchmark-runner.js';
export * from './learning/promotion-gate.js';
export * from './learning/rollout-manager.js';

// Central registry
export * from './evolution-registry.js';
export * from './changepoint-detector/index.js';
export * from './cross-agent-analyzer/index.js';
export * from './fingerprint-builder/index.js';
