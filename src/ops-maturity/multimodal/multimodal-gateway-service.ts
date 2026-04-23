/**
 * @fileoverview Multimodal Gateway Service
 *
 * Provides unified multimodal input processing across text, image, audio, document, and video.
 *
 * §68B Multimodal Video Processing Pipeline (P2 Enhancement for Phase 3):
 * Current VideoProcessor implementation is based on URI metadata parsing and simulated transcription
 * (extractVideoMetadata / transcribeVideo / extractVideoKeyFrames). To implement a complete video
 * processing pipeline, the following are needed: end-to-end codec support, real media链路 integration
 * (video frame extraction, scene detection, content analysis), and deep integration with external
 * video processing services (FFmpeg/media cloud). Currently only metadata parsing and simulated
 * transcription skeleton exist.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { countDocumentPages } from "./document-parser/index.js";
import { normalizeImageAspectRatio, type ImageMetadata } from "./image-processor/index.js";
import { resolveInputModality } from "./modality-router/index.js";
import { estimateSpeechDurationMs } from "./speech-processor/index.js";
import { extractVideoMetadata, transcribeVideo, extractVideoKeyFrames, type VideoMetadata } from "./video-processor/index.js";

export type MultimodalPartType = "text" | "image" | "audio" | "document" | "video";

export { type VideoMetadata } from "./video-processor/index.js";

export interface MultimodalInputPart {
  readonly partId: string;
  readonly type: string;
  readonly contentRef: string;
  readonly text?: string;
  readonly imageMetadata?: ImageMetadata;
  readonly videoMetadata?: VideoMetadata;
  readonly audioSampleCount?: number;
  readonly audioSampleRate?: number;
  readonly documentChunks?: readonly string[];
  readonly dataClassification?: "public" | "internal" | "restricted";
}

export interface MultimodalRequest {
  readonly requestId: string;
  readonly modalities: readonly string[];
  readonly inputParts: readonly MultimodalInputPart[];
  readonly requestedOutputs: readonly string[];
  readonly safetyPolicyRef: string;
  readonly costBudget: {
    readonly maxUsd: number;
  };
  readonly traceId?: string;
}

export interface ModalityRouteDecision {
  readonly partId: string;
  readonly modality: MultimodalPartType;
  readonly provider: string;
  readonly processor: string;
  readonly estimatedCostUsd: number;
}

export interface MultimodalSafetyFinding {
  readonly partId: string;
  readonly severity: "low" | "medium" | "high";
  readonly reasonCode: string;
  readonly blocked: boolean;
}

export interface MultimodalGatewayResult {
  readonly gatewayRunId: string;
  readonly requestId: string;
  readonly traceId: string;
  readonly routeDecisions: readonly ModalityRouteDecision[];
  readonly safetyFindings: readonly MultimodalSafetyFinding[];
  readonly blocked: boolean;
  readonly estimatedCostUsd: number;
  readonly normalizedInputs: readonly {
    readonly partId: string;
    readonly modality: MultimodalPartType;
    readonly summary: string;
  }[];
  readonly createdAt: string;
}

const PROVIDER_BY_MODALITY: Record<MultimodalPartType, { provider: string; processor: string; unitCostUsd: number }> = {
  text: { provider: "text_gateway", processor: "text-normalizer", unitCostUsd: 0.01 },
  image: { provider: "vision_gateway", processor: "image-processor", unitCostUsd: 0.08 },
  audio: { provider: "speech_gateway", processor: "speech-processor", unitCostUsd: 0.05 },
  document: { provider: "document_gateway", processor: "document-parser", unitCostUsd: 0.03 },
  video: { provider: "video_gateway", processor: "video-processor", unitCostUsd: 0.12 },
};

export class MultimodalGatewayService {
  public handle(request: MultimodalRequest, createdAt = nowIso()): MultimodalGatewayResult {
    if (request.safetyPolicyRef.trim().length === 0) {
      throw new Error(`multimodal_gateway.safety_policy_required:${request.requestId}`);
    }

    const routeDecisions: ModalityRouteDecision[] = [];
    const normalizedInputs: MultimodalGatewayResult["normalizedInputs"][number][] = [];
    const safetyFindings: MultimodalSafetyFinding[] = [];

    for (const part of request.inputParts) {
      const modality = resolveInputModality(part.type);
      if (modality === "unsupported") {
        throw new Error(`multimodal_gateway.unsupported_modality:${part.type}`);
      }
      if (!request.modalities.includes(modality)) {
        throw new Error(`multimodal_gateway.modality_not_declared:${modality}`);
      }

      const route = PROVIDER_BY_MODALITY[modality];
      const estimatedCostUsd = this.estimatePartCost(part, modality, route.unitCostUsd);
      routeDecisions.push({
        partId: part.partId,
        modality,
        provider: route.provider,
        processor: route.processor,
        estimatedCostUsd,
      });
      normalizedInputs.push({
        partId: part.partId,
        modality,
        summary: this.summarizePart(part, modality),
      });
      safetyFindings.push(...this.evaluateSafety(part, modality));
    }

    const estimatedCostUsd = Number(routeDecisions.reduce((sum, item) => sum + item.estimatedCostUsd, 0).toFixed(4));
    if (estimatedCostUsd > request.costBudget.maxUsd) {
      safetyFindings.push({
        partId: request.requestId,
        severity: "high",
        reasonCode: "multimodal_gateway.cost_budget_exceeded",
        blocked: true,
      });
    }

    return {
      gatewayRunId: newId("multimodal_run"),
      requestId: request.requestId,
      traceId: request.traceId ?? newId("trace"),
      routeDecisions,
      safetyFindings,
      blocked: safetyFindings.some((item) => item.blocked),
      estimatedCostUsd,
      normalizedInputs,
      createdAt,
    };
  }

  private estimatePartCost(part: MultimodalInputPart, modality: MultimodalPartType, unitCostUsd: number): number {
    switch (modality) {
      case "document":
        return Number((unitCostUsd * Math.max(1, countDocumentPages(part.documentChunks ?? []))).toFixed(4));
      case "audio":
        return Number((unitCostUsd * Math.max(1, estimateSpeechDurationMs(part.audioSampleCount ?? 0, part.audioSampleRate ?? 1) / 1000)).toFixed(4));
      case "video":
        return Number((unitCostUsd * Math.max(1, (part.videoMetadata?.durationMs ?? 0) / 1000)).toFixed(4));
      case "image":
        return unitCostUsd;
      case "text":
      default:
        return unitCostUsd;
    }
  }

  private summarizePart(part: MultimodalInputPart, modality: MultimodalPartType): string {
    switch (modality) {
      case "document":
        return `document_pages=${countDocumentPages(part.documentChunks ?? [])}`;
      case "audio":
        return `audio_duration_ms=${estimateSpeechDurationMs(part.audioSampleCount ?? 0, part.audioSampleRate ?? 1)}`;
      case "video":
        return `video_duration_ms=${part.videoMetadata?.durationMs ?? 0},resolution=${part.videoMetadata?.width ?? 0}x${part.videoMetadata?.height ?? 0}`;
      case "image":
        return `image_aspect_ratio=${normalizeImageAspectRatio(part.imageMetadata ?? { width: 0, height: 0 })}`;
      case "text":
      default:
        return `text_chars=${part.text?.length ?? 0}`;
    }
  }

  private evaluateSafety(part: MultimodalInputPart, modality: MultimodalPartType): MultimodalSafetyFinding[] {
    const findings: MultimodalSafetyFinding[] = [];
    if (part.dataClassification === "restricted") {
      findings.push({
        partId: part.partId,
        severity: "high",
        reasonCode: "multimodal_gateway.restricted_input_blocked",
        blocked: true,
      });
    }
    if (modality === "image" && (part.imageMetadata?.width ?? 0) <= 0) {
      findings.push({
        partId: part.partId,
        severity: "medium",
        reasonCode: "multimodal_gateway.invalid_image_metadata",
        blocked: true,
      });
    }
    return findings;
  }
}
