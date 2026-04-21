/**
 * Knowledge Promotion Service — GAP-V2-G7
 *
 * Bridges the Learn and Knowledge planes by promoting validated LearningObjects
 * into the knowledge plane for retrieval during future Observe phases.
 *
 * Design: §8/§C.12 — Learn→Knowledge integration
 *
 * Data flow:
 *   StrategyLearningService.learn()
 *     → LearningObject[] (already validated by LearningObjectValidator)
 *     → KnowledgePromotionService.promote()
 *       → KnowledgePlaneService.ingest()
 *         → KnowledgeArchive + KeywordIndex + SemanticIndex
 *       → Emit "learning:knowledge_promoted" event (Tier 2)
 *
 * Promoted objects use:
 *   - namespace: "system/learned-patterns"
 *   - trustLevel: "reviewed" (because they passed LearningObjectValidator)
 *   - source: { type: "system_generated", uri: "learning://{kind}/{id}" }
 */
import type { LearningObject } from "./learning-object-model.js";
import { KnowledgePlaneService } from "../../../state-evidence/knowledge/knowledge-plane-service.js";
import type { TypedEventPublisher } from "../../../state-evidence/events/typed-event-publisher.js";
export interface KnowledgePromotionResult {
    promotedCount: number;
    failedCount: number;
    knowledgeDocumentIds: string[];
}
export interface KnowledgePromotionServiceOptions {
    knowledgePlane?: KnowledgePlaneService;
    eventPublisher?: TypedEventPublisher | null;
}
/**
 * Promotes validated LearningObjects into the knowledge plane.
 *
 * Only objects that have:
 * - Passed LearningObjectValidator.validateMany() (valid evidence + sufficient confidence)
 * - promotionStatus === "validated" or "promoted"
 *
 * Are eligible for promotion to "system/learned-patterns" namespace.
 */
export declare class KnowledgePromotionService {
    private readonly knowledgePlane;
    private readonly eventPublisher;
    constructor(options?: KnowledgePromotionServiceOptions);
    /**
     * Promotes validated learning objects into the knowledge plane.
     *
     * @param learningObjects - Validated learning objects from StrategyLearningService
     * @param taskId - Associated task ID for event tracing
     * @returns Promotion result with counts and document IDs
     */
    promote(learningObjects: readonly LearningObject[], taskId: string): KnowledgePromotionResult;
    /**
     * Builds the body text from a LearningObject for knowledge ingestion.
     */
    private buildBody;
}
