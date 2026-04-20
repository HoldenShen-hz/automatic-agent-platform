/**
 * Evolution Engine Module
 *
 * Provides agent self-improvement capabilities through evidence collection,
 * reflection, proposal generation, benchmarking, and staged rollout.
 */

// Core MVP service (existing)
export * from './evolution-mvp-service.js';

// Evidence and Reflection
export * from './evidence-store.js';
export * from './reflection-engine.js';

// Proposal generation
export * from './proposal-engine.js';

// Evaluation
export * from './benchmark-runner.js';

// Promotion control
export * from './promotion-gate.js';

// Rollout management
export * from './rollout-manager.js';

// Central registry
export * from './evolution-registry.js';
export * from './changepoint-detector/index.js';
export * from './cross-agent-analyzer/index.js';
export * from './fingerprint-builder/index.js';
