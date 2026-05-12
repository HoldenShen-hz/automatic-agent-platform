/**
 * Memory Module
 *
 * Provides memory storage, retrieval, consolidation, and quality management.
 * Built on AuthoritativeTaskStore with support for layered memory architecture.
 */

// Re-export public interfaces
export * from './memory-service.js';
export * from './memory-retrieval-service.js';
export * from './memory-consolidation.js';
export * from './memory-quality.js';
export * from './memory-schema.js';
export * from './memory-provider.js';
export * from './builtin-memory-provider.js';
export * from './experience-cache-service.js';
export * from './memory-layer-model.js';
export * from './project-memory-store.js';
export * from './user-memory-store.js';
export * from './memory-promotion-engine.js';
export {
  KnowledgePromotionTier,
  PromotionStatus,
  KnowledgeLineage,
  KnowledgeLineageMetadata,
  VerificationStatus,
  PromotionCandidate,
  PromotionRequest,
  PromotionRule,
  DEFAULT_PROMOTION_RULES,
  KnowledgePromotionService,
} from './knowledge-promotion-service.js';
export * from './memory-write-request.js';
export * from './layer-transition-service.js';
export * from './memory-decay-service.js';
export * from './trust-level-service.js';
