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
export * from "./evolution-mvp-service.js";

// Flat exports route through the sibling wrappers so root consumers have one canonical surface.
export * from "./evidence-store.js";
export * from "./reflection-engine.js";
export * from "./proposal-engine.js";
export * from "./benchmark-runner.js";
export * from "./promotion-gate.js";
export * from "./rollout-manager.js";
export * from "./rollout-repository.js";

// Central registry
export * from "./evolution-registry.js";
export * from "./changepoint-detector/index.js";
export * from "./cross-agent-analyzer/index.js";
export * from "./drift-detector.js";
export * from "./drift-detector-service.js";
export * from "./drift-types.js";
export * from "./fingerprint-builder/index.js";
