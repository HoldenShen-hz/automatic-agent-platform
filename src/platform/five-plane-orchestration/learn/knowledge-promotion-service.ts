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
 *   - namespace: "system.learned.patterns"
 *   - trustLevel: "reviewed" (because they passed LearningObjectValidator)
 *   - source: { type: "system_generated", uri: "learning://{kind}/{id}" }
 */

import type { LearningObject } from "./learning-object-model.js";
import { KnowledgePlaneService } from "../../state-evidence/knowledge/knowledge-plane-service.js";
import type { TypedEventPublisher } from "../../state-evidence/events/typed-event-publisher.js";
import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 200 });

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
 * Are eligible for promotion to "system.learned.patterns" namespace.
 */
export class KnowledgePromotionService {
  private readonly knowledgePlane: KnowledgePlaneService;
  private readonly eventPublisher: TypedEventPublisher | null;

  constructor(options: KnowledgePromotionServiceOptions = {}) {
    this.knowledgePlane = options.knowledgePlane ?? new KnowledgePlaneService();
    this.eventPublisher = options.eventPublisher ?? null;
  }

  /**
   * Promotes validated learning objects into the knowledge plane.
   *
   * @param learningObjects - Validated learning objects from StrategyLearningService
   * @param taskId - Associated task ID for event tracing
   * @returns Promotion result with counts and document IDs
   */
  public promote(learningObjects: readonly LearningObject[], taskId: string): KnowledgePromotionResult {
    const promoted: Array<{ objectId: string; documentId: string }> = [];
    const failed: string[] = [];

    for (const obj of learningObjects) {
      if (obj.promotionStatus !== "validated" && obj.promotionStatus !== "promoted") {
        continue;
      }

      try {
        const body = this.buildBody(obj);
        const result = this.knowledgePlane.ingest({
          title: obj.title,
          body,
          namespace: "system.learned.patterns",
          uri: `learning://${obj.learningType}/${obj.learningObjectId}`,
          sourceType: "text",
          trustLevel: "reviewed",
          tags: [obj.learningType, `confidence:${obj.confidence.toFixed(2)}`],
        });

        promoted.push({ objectId: obj.learningObjectId, documentId: result.document.documentId });
      } catch (err) {
        failed.push(obj.learningObjectId);
        // Log but don't throw — promotion failure should not block the loop
        logger.error(`[KnowledgePromotion] Failed to promote ${obj.learningObjectId}`, { error: String(err) });
      }
    }

    // Emit learning:knowledge_promoted event (Tier 2) for downstream consumers
    if (promoted.length > 0 && this.eventPublisher) {
      const promotedCount = promoted.length;
      for (const { objectId, documentId } of promoted) {
        const obj = learningObjects.find((item) => item.learningObjectId === objectId);
        if (!obj) {
          continue;
        }
        this.eventPublisher.publish({
          eventType: "learning:knowledge_promoted",
          taskId,
          payload: {
            learningObjectId: obj.learningObjectId,
            learningType: obj.learningType,
            documentId,
            namespace: "system.learned.patterns",
            trustLevel: "reviewed",
            promotedCount,
            occurredAt: nowIso(),
          },
        });
      }
    }

    return {
      promotedCount: promoted.length,
      failedCount: failed.length,
      knowledgeDocumentIds: promoted.map((item) => item.documentId),
    };
  }

  /**
   * Builds the body text from a LearningObject for knowledge ingestion.
   */
  private buildBody(obj: LearningObject): string {
    const lines: string[] = [
      `# ${obj.title}`,
      "",
      `**Type:** ${obj.learningType}`,
      `**Confidence:** ${(obj.confidence * 100).toFixed(0)}%`,
      `**Validated by:** ${obj.validatedBy}`,
      "",
      `## Summary`,
      obj.summary,
      "",
      `## Recommendation`,
      obj.recommendation,
    ];

    if (obj.evidenceRefs.length > 0) {
      lines.push("", `## Evidence (${obj.evidenceRefs.length} refs)`);
      for (const ref of obj.evidenceRefs) {
        lines.push(`- ${ref}`);
      }
    }

    if (obj.sourceSignalIds.length > 0) {
      lines.push("", `## Source Signals`);
      for (const signalId of obj.sourceSignalIds) {
        lines.push(`- ${signalId}`);
      }
    }

    return lines.join("\n");
  }
}
