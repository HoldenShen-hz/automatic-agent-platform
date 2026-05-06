/**
 * @fileoverview Multimodal Gateway Service
 *
 * Provides unified multimodal input processing across text, image, audio, document, and video.
 * Video parts are normalized through a deterministic pipeline that materializes metadata,
 * transcript segments, scene timeline, keyframes, and readiness assessment inside the repo.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { z } from "zod";
import { countDocumentPages } from "./document-parser/index.js";
import { normalizeImageAspectRatio, type ImageMetadata } from "./image-processor/index.js";
import { resolveInputModality } from "./modality-router/index.js";
import { estimateSpeechDurationMs } from "./speech-processor/index.js";
import { VideoProcessor, type ProcessedVideo, type VideoMetadata } from "./video-processor/index.js";

export type MultimodalPartType = "text" | "image" | "audio" | "document" | "video";

export { type VideoMetadata } from "./video-processor/index.js";

export interface MultimodalInputPart {
  readonly partId: string;
  readonly type: string;
  readonly contentRef: string;
  readonly provenance?: {
    readonly c2pa?: string | undefined;
    readonly watermark?: string | undefined;
    readonly hash?: string | undefined;
    readonly license?: string | undefined;
  } | undefined;
  readonly artifactRef?: string | undefined;
  readonly safetyLabels?: readonly string[] | undefined;
  readonly mimeType?: string | undefined;
  readonly costKey?: string | undefined;
  readonly text?: string | undefined;
  readonly imageMetadata?: ImageMetadata | undefined;
  readonly videoMetadata?: VideoMetadata | undefined;
  readonly audioSampleCount?: number | undefined;
  readonly audioSampleRate?: number | undefined;
  readonly documentChunks?: readonly string[] | undefined;
  readonly dataClassification?: "public" | "internal" | "restricted" | undefined;
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
  readonly traceId?: string | undefined;
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
  readonly confidence?: number | undefined;
  readonly policyDecision?: string | undefined;
  readonly appealPath?: string | undefined;
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

const MultimodalPartTypeSchema = z.enum(["text", "image", "audio", "document", "video"]);
const DataClassificationSchema = z.enum(["public", "internal", "restricted"]);

const ImageMetadataSchema = z.object({
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
});

const VideoMetadataSchema = z.object({
  durationMs: z.number().finite().nonnegative(),
  width: z.number().finite().nonnegative(),
  height: z.number().finite().nonnegative(),
  codec: z.string().min(1),
});

const MultimodalProvenanceSchema = z.object({
  c2pa: z.string().min(1).optional(),
  watermark: z.string().min(1).optional(),
  hash: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
}).strict();

export const MultimodalInputPartSchema = z.object({
  partId: z.string().min(1),
  type: z.string().min(1),
  contentRef: z.string().min(1),
  provenance: MultimodalProvenanceSchema.optional(),
  artifactRef: z.string().min(1).optional(),
  safetyLabels: z.array(z.string().min(1)).optional(),
  mimeType: z.string().min(1).optional(),
  costKey: z.string().min(1).optional(),
  text: z.string().optional(),
  imageMetadata: ImageMetadataSchema.optional(),
  videoMetadata: VideoMetadataSchema.optional(),
  audioSampleCount: z.number().int().nonnegative().optional(),
  audioSampleRate: z.number().int().positive().optional(),
  documentChunks: z.array(z.string()).optional(),
  dataClassification: DataClassificationSchema.optional(),
}).strict();

export const MultimodalRequestSchema = z.object({
  requestId: z.string().min(1),
  modalities: z.array(MultimodalPartTypeSchema).min(1),
  inputParts: z.array(MultimodalInputPartSchema).min(1),
  requestedOutputs: z.array(z.string().min(1)).min(1),
  safetyPolicyRef: z.string(),
  costBudget: z.object({
    maxUsd: z.number().finite().nonnegative(),
  }).strict(),
  traceId: z.string().min(1).optional(),
}).strict();

export const ModalityRouteDecisionSchema = z.object({
  partId: z.string().min(1),
  modality: MultimodalPartTypeSchema,
  provider: z.string().min(1),
  processor: z.string().min(1),
  estimatedCostUsd: z.number().finite().nonnegative(),
}).strict();

export const MultimodalSafetyFindingSchema = z.object({
  partId: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  reasonCode: z.string().min(1),
  blocked: z.boolean(),
  confidence: z.number().finite().min(0).max(1).optional(),
  policyDecision: z.string().min(1).optional(),
  appealPath: z.string().min(1).optional(),
}).strict();

export function parseMultimodalRequest(value: unknown): MultimodalRequest {
  return MultimodalRequestSchema.parse(value);
}

export function parseModalityRouteDecision(value: unknown): ModalityRouteDecision {
  return ModalityRouteDecisionSchema.parse(value);
}

export function parseMultimodalSafetyFinding(value: unknown): MultimodalSafetyFinding {
  return MultimodalSafetyFindingSchema.parse(value);
}

const PROVIDER_BY_MODALITY: Record<MultimodalPartType, { provider: string; processor: string; unitCostUsd: number }> = {
  text: { provider: "text_gateway", processor: "text-normalizer", unitCostUsd: 0.01 },
  image: { provider: "vision_gateway", processor: "image-processor", unitCostUsd: 0.08 },
  audio: { provider: "speech_gateway", processor: "speech-processor", unitCostUsd: 0.05 },
  document: { provider: "document_gateway", processor: "document-parser", unitCostUsd: 0.03 },
  video: { provider: "video_gateway", processor: "video-processor", unitCostUsd: 0.12 },
};

export class MultimodalGatewayService {
  public constructor(private readonly videoProcessor: VideoProcessor = new VideoProcessor()) {}

  public handle(request: MultimodalRequest, createdAt = nowIso()): MultimodalGatewayResult {
    const parsedRequest = parseMultimodalRequest(request);

    if (parsedRequest.safetyPolicyRef.trim().length === 0) {
      throw new Error(`multimodal_gateway.safety_policy_required:${parsedRequest.requestId}`);
    }

    const routeDecisions: ModalityRouteDecision[] = [];
    const normalizedInputs: MultimodalGatewayResult["normalizedInputs"][number][] = [];
    const safetyFindings: MultimodalSafetyFinding[] = [];

    for (const part of parsedRequest.inputParts) {
      const modality = resolveInputModality(part.type);
      if (modality === "unsupported") {
        throw new Error(`multimodal_gateway.unsupported_modality:${part.type}`);
      }
      if (!parsedRequest.modalities.includes(modality)) {
        throw new Error(`multimodal_gateway.modality_not_declared:${modality}`);
      }

      const route = PROVIDER_BY_MODALITY[modality];
      const processedVideo = modality === "video" ? this.resolveProcessedVideo(part) : null;
      const estimatedCostUsd = this.estimatePartCost(part, modality, route.unitCostUsd, processedVideo);
      routeDecisions.push(parseModalityRouteDecision({
        partId: part.partId,
        modality,
        provider: route.provider,
        processor: route.processor,
        estimatedCostUsd,
      }));
      normalizedInputs.push({
        partId: part.partId,
        modality,
        summary: this.summarizePart(part, modality, processedVideo),
      });
      safetyFindings.push(...this.evaluateSafety(part, modality, processedVideo).map(parseMultimodalSafetyFinding));
    }

    const estimatedCostUsd = Number(routeDecisions.reduce((sum, item) => sum + item.estimatedCostUsd, 0).toFixed(4));
    if (estimatedCostUsd > parsedRequest.costBudget.maxUsd) {
      safetyFindings.push(parseMultimodalSafetyFinding({
        partId: parsedRequest.requestId,
        severity: "high",
        reasonCode: "multimodal_gateway.cost_budget_exceeded",
        blocked: true,
      }));
    }

    return {
      gatewayRunId: newId("multimodal_run"),
      requestId: parsedRequest.requestId,
      traceId: parsedRequest.traceId ?? newId("trace"),
      routeDecisions,
      safetyFindings,
      blocked: safetyFindings.some((item) => item.blocked),
      estimatedCostUsd,
      normalizedInputs,
      createdAt,
    };
  }

  private estimatePartCost(
    part: MultimodalInputPart,
    modality: MultimodalPartType,
    unitCostUsd: number,
    processedVideo: ProcessedVideo | null,
  ): number {
    switch (modality) {
      case "document":
        return Number((unitCostUsd * Math.max(1, countDocumentPages(part.documentChunks ?? []))).toFixed(4));
      case "audio":
        return Number((unitCostUsd * Math.max(1, estimateSpeechDurationMs(part.audioSampleCount ?? 0, part.audioSampleRate ?? 1) / 1000)).toFixed(4));
      case "video":
        return Number((unitCostUsd * Math.max(1, (processedVideo?.metadata.durationMs ?? part.videoMetadata?.durationMs ?? 0) / 1000)).toFixed(4));
      case "image":
        return unitCostUsd;
      case "text":
      default:
        return unitCostUsd;
    }
  }

  private summarizePart(part: MultimodalInputPart, modality: MultimodalPartType, processedVideo: ProcessedVideo | null): string {
    switch (modality) {
      case "document":
        return `document_pages=${countDocumentPages(part.documentChunks ?? [])}`;
      case "audio":
        return `audio_duration_ms=${estimateSpeechDurationMs(part.audioSampleCount ?? 0, part.audioSampleRate ?? 1)}`;
      case "video":
        return [
          `video_duration_ms=${processedVideo?.metadata.durationMs ?? part.videoMetadata?.durationMs ?? 0}`,
          `resolution=${processedVideo?.metadata.width ?? part.videoMetadata?.width ?? 0}x${processedVideo?.metadata.height ?? part.videoMetadata?.height ?? 0}`,
          `scenes=${processedVideo?.scenes.length ?? 0}`,
          `transcript_segments=${processedVideo?.transcriptSegments.length ?? 0}`,
          `quality=${processedVideo?.qualityAssessment.readiness ?? "conditional"}`,
        ].join(",");
      case "image":
        return `image_aspect_ratio=${normalizeImageAspectRatio(part.imageMetadata ?? { width: 0, height: 0 })}`;
      case "text":
      default:
        return `text_chars=${part.text?.length ?? 0}`;
    }
  }

  private evaluateSafety(
    part: MultimodalInputPart,
    modality: MultimodalPartType,
    processedVideo: ProcessedVideo | null,
  ): MultimodalSafetyFinding[] {
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
    if (modality === "video" && processedVideo?.qualityAssessment.readiness === "blocked") {
      findings.push({
        partId: part.partId,
        severity: "high",
        reasonCode: "multimodal_gateway.invalid_video_pipeline",
        blocked: true,
      });
    }
    if (modality === "video" && processedVideo != null && processedVideo.qualityAssessment.reasonCodes.length > 0) {
      findings.push({
        partId: part.partId,
        severity: processedVideo.qualityAssessment.readiness === "ready" ? "low" : "medium",
        reasonCode: processedVideo.qualityAssessment.reasonCodes[0]!,
        blocked: processedVideo.qualityAssessment.readiness === "blocked",
      });
    }
    if ((part.mimeType ?? "").trim().length === 0) {
      findings.push({
        partId: part.partId,
        severity: "medium",
        reasonCode: "multimodal_gateway.mime_type_required",
        blocked: true,
      });
    }
    return findings;
  }

  private resolveProcessedVideo(part: MultimodalInputPart): ProcessedVideo {
    return this.videoProcessor.processVideo({
      uri: part.contentRef,
      ...(part.videoMetadata != null ? { metadata: part.videoMetadata } : {}),
    });
  }
}
