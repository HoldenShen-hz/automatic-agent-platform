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
import { type ImageMetadata } from "./image-processor/index.js";
import { type VideoMetadata } from "./video-processor/index.js";
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
export declare class MultimodalGatewayService {
    handle(request: MultimodalRequest, createdAt?: string): MultimodalGatewayResult;
    private estimatePartCost;
    private summarizePart;
    private evaluateSafety;
}
