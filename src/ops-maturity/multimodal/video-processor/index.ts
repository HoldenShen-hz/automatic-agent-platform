import path from "node:path";

export interface VideoMetadata {
  readonly durationMs: number;
  readonly width: number;
  readonly height: number;
  readonly codec: string;
  readonly frameRate?: number;
  readonly audioChannels?: number;
}

export interface VideoKeyFrame {
  readonly frameId: string;
  readonly timestampMs: number;
  readonly sceneId?: string;
  readonly imageData: string;
}

export interface VideoTranscriptSegment {
  readonly segmentId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;
  readonly confidence: number;
}

export interface VideoSceneSegment {
  readonly sceneId: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly dominantKeywords: readonly string[];
}

export interface VideoQualityAssessment {
  readonly readiness: "ready" | "conditional" | "blocked";
  readonly reasonCodes: readonly string[];
  readonly hasSpeech: boolean;
  readonly sceneCount: number;
  readonly keyFrameCount: number;
}

export interface ProcessedVideo {
  readonly metadata: VideoMetadata;
  readonly transcript: string;
  readonly transcriptSegments: readonly VideoTranscriptSegment[];
  readonly scenes: readonly VideoSceneSegment[];
  readonly keyFrames: readonly VideoKeyFrame[];
  readonly qualityAssessment: VideoQualityAssessment;
}

interface AssessVideoQualityInput {
  readonly metadata: VideoMetadata;
  readonly transcriptSegments: readonly VideoTranscriptSegment[];
  readonly scenes: readonly VideoSceneSegment[];
  readonly keyFrames: readonly VideoKeyFrame[];
}

interface VideoProcessingRequest {
  readonly uri: string;
  readonly metadata?: Partial<VideoMetadata>;
}

const DEFAULT_METADATA: VideoMetadata = {
  durationMs: 30_000,
  width: 1280,
  height: 720,
  codec: "h264",
};

const TRANSCRIPT_UNAVAILABLE = "video transcript unavailable";
const TRANSCRIPT_CONFIDENCE = 0.82;
const DEFAULT_KEYFRAME_INTERVAL_MS = 10_000;
const MIN_KEYFRAME_INTERVAL_MS = 1_000;
const SCENE_TIMELINE_SLICE_MS = 15_000;

export function extractVideoMetadata(uri: string): VideoMetadata {
  const basename = path.basename(uri);
  const resolutionMatch = basename.match(/(\d{2,5})x(\d{2,5})/i);
  const durationMatch = basename.match(/(?:^|[_.-])(\d+)(ms|s|m)(?:$|[_.-])/i);
  const frameRateMatch = basename.match(/(?:^|[_.-])(\d+)fps(?:$|[_.-])/i);
  const audioChannelsMatch = basename.match(/(?:^|[_.-])(\d+)ch(?:$|[_.-])/i);
  const extension = path.extname(basename).replace(/^\./, "").toLowerCase();

  return {
    durationMs: parseDurationHint(durationMatch?.[1], durationMatch?.[2]) ?? DEFAULT_METADATA.durationMs,
    width: resolutionMatch == null ? DEFAULT_METADATA.width : Number.parseInt(resolutionMatch[1]!, 10),
    height: resolutionMatch == null ? DEFAULT_METADATA.height : Number.parseInt(resolutionMatch[2]!, 10),
    codec: normalizeCodec(extension),
    ...(frameRateMatch == null ? {} : { frameRate: Number.parseInt(frameRateMatch[1]!, 10) }),
    ...(audioChannelsMatch == null ? {} : { audioChannels: Number.parseInt(audioChannelsMatch[1]!, 10) }),
  };
}

export function transcribeVideo(uri: string): string {
  const normalized = normalizeSemanticTokens(uri);
  return normalized.length === 0 ? TRANSCRIPT_UNAVAILABLE : normalized;
}

export function extractVideoTranscriptSegments(
  uri: string,
  metadata: VideoMetadata,
): readonly VideoTranscriptSegment[] {
  const transcript = transcribeVideo(uri);
  if (transcript === TRANSCRIPT_UNAVAILABLE) {
    return [];
  }

  return [
    {
      segmentId: "segment_1",
      startMs: 0,
      endMs: Math.max(0, metadata.durationMs),
      text: transcript,
      confidence: TRANSCRIPT_CONFIDENCE,
    },
  ];
}

export function detectVideoScenes(
  uri: string,
  metadata: VideoMetadata,
  transcriptSegments: readonly VideoTranscriptSegment[] = [],
): readonly VideoSceneSegment[] {
  const sceneCount = resolveSceneCount(uri, metadata.durationMs);
  const durationMs = Math.max(0, metadata.durationMs);
  const sceneSpanMs = sceneCount <= 0 ? 0 : durationMs / sceneCount;
  const keywordPool = buildKeywordPool(uri, transcriptSegments);

  return Array.from({ length: sceneCount }, (_, index) => {
    const startMs = durationMs === 0 ? 0 : Math.floor(sceneSpanMs * index);
    const endMs = index === sceneCount - 1 ? durationMs : Math.floor(sceneSpanMs * (index + 1));
    return {
      sceneId: `scene_${index + 1}`,
      startMs,
      endMs,
      dominantKeywords: selectSceneKeywords(keywordPool, index),
    };
  });
}

export function extractVideoKeyFrames(
  uri: string,
  intervalSeconds = DEFAULT_KEYFRAME_INTERVAL_MS / 1000,
  metadata: VideoMetadata = extractVideoMetadata(uri),
  scenes: readonly VideoSceneSegment[] = detectVideoScenes(uri, metadata),
): readonly VideoKeyFrame[] {
  const durationMs = Math.max(0, metadata.durationMs);
  const intervalMs = Math.max(MIN_KEYFRAME_INTERVAL_MS, Math.floor(intervalSeconds * 1000));
  const timestamps = durationMs > 0 ? buildKeyFrameTimeline(durationMs, intervalMs) : [0];

  return timestamps.map((timestampMs, index) => {
    const sceneId = scenes.find((scene) => timestampMs >= scene.startMs && timestampMs < Math.max(scene.endMs, scene.startMs + 1))?.sceneId
      ?? scenes.at(-1)?.sceneId;

    return {
      frameId: `frame_${index + 1}`,
      timestampMs,
      ...(sceneId == null ? {} : { sceneId }),
      imageData: `frame:${timestampMs}:${path.basename(uri)}`,
    };
  });
}

export function assessVideoQuality(input: AssessVideoQualityInput): VideoQualityAssessment {
  const reasonCodes: string[] = [];

  if (input.metadata.durationMs <= 0) {
    reasonCodes.push("video_processor.zero_duration");
  }
  if (input.metadata.width <= 0 || input.metadata.height <= 0) {
    reasonCodes.push("video_processor.invalid_resolution");
  }
  if (input.transcriptSegments.length === 0) {
    reasonCodes.push("video_processor.no_transcript_segments");
  }
  if (input.scenes.length === 0) {
    reasonCodes.push("video_processor.no_scene_timeline");
  }

  const readiness = reasonCodes.includes("video_processor.zero_duration") || reasonCodes.includes("video_processor.invalid_resolution")
    ? "blocked"
    : reasonCodes.length > 0
      ? "conditional"
      : "ready";

  return {
    readiness,
    reasonCodes,
    hasSpeech: input.transcriptSegments.length > 0,
    sceneCount: input.scenes.length,
    keyFrameCount: input.keyFrames.length,
  };
}

export class VideoProcessor {
  public processVideo(request: VideoProcessingRequest): ProcessedVideo {
    const metadata = mergeMetadata(extractVideoMetadata(request.uri), request.metadata);
    const transcript = transcribeVideo(request.uri);
    const transcriptSegments = extractVideoTranscriptSegments(request.uri, metadata);
    const scenes = detectVideoScenes(request.uri, metadata, transcriptSegments);
    const keyFrames = extractVideoKeyFrames(request.uri, DEFAULT_KEYFRAME_INTERVAL_MS / 1000, metadata, scenes);
    const qualityAssessment = assessVideoQuality({
      metadata,
      transcriptSegments,
      scenes,
      keyFrames,
    });

    return {
      metadata,
      transcript,
      transcriptSegments,
      scenes,
      keyFrames,
      qualityAssessment,
    };
  }
}

function mergeMetadata(parsed: VideoMetadata, provided?: Partial<VideoMetadata>): VideoMetadata {
  if (provided == null) {
    return parsed;
  }

  return {
    durationMs: provided.durationMs ?? parsed.durationMs,
    width: provided.width ?? parsed.width,
    height: provided.height ?? parsed.height,
    codec: provided.codec ?? parsed.codec,
    ...(provided.frameRate ?? parsed.frameRate) == null ? {} : { frameRate: provided.frameRate ?? parsed.frameRate },
    ...(provided.audioChannels ?? parsed.audioChannels) == null ? {} : { audioChannels: provided.audioChannels ?? parsed.audioChannels },
  };
}

function parseDurationHint(amount?: string, unit?: string): number | undefined {
  if (amount == null || unit == null) {
    return undefined;
  }

  const value = Number.parseInt(amount, 10);
  if (!Number.isFinite(value)) {
    return undefined;
  }

  switch (unit.toLowerCase()) {
    case "ms":
      return value;
    case "m":
      return value * 60_000;
    case "s":
    default:
      return value * 1_000;
  }
}

function normalizeCodec(extension: string): string {
  switch (extension) {
    case "mp4":
    case "mov":
    case "webm":
      return extension;
    case "avi":
      return "h264";
    default:
      return extension.length === 0 ? DEFAULT_METADATA.codec : extension;
  }
}

function resolveSceneCount(uri: string, durationMs: number): number {
  const basename = path.basename(uri);
  const sceneHintMatch = basename.match(/(?:^|[_.-])scenes(\d+)(?:$|[_.-])/i);
  if (sceneHintMatch != null) {
    return Math.max(1, Number.parseInt(sceneHintMatch[1]!, 10));
  }

  return Math.max(1, Math.min(12, Math.ceil(Math.max(0, durationMs) / SCENE_TIMELINE_SLICE_MS)));
}

function normalizeSemanticTokens(uri: string): string {
  const basename = path.basename(uri, path.extname(uri));
  const stripped = basename
    .replace(/\d{2,5}x\d{2,5}/gi, " ")
    .replace(/(?:^|[_.-])\d+(?:ms|s|m)(?:$|[_.-])/gi, " ")
    .replace(/(?:^|[_.-])\d+fps(?:$|[_.-])/gi, " ")
    .replace(/(?:^|[_.-])\d+ch(?:$|[_.-])/gi, " ")
    .replace(/(?:^|[_.-])scenes\d+(?:$|[_.-])/gi, " ")
    .replace(/[_./:-]+/g, " ")
    .trim();

  const tokens = stripped
    .split(/\s+/)
    .map((token) => token.toLowerCase())
    .filter((token) => /[a-z]/.test(token) && !/^\d+$/.test(token));

  return tokens.join(" ");
}

function buildKeywordPool(uri: string, transcriptSegments: readonly VideoTranscriptSegment[]): readonly string[] {
  const transcriptTokens = transcriptSegments
    .flatMap((segment) => segment.text.toLowerCase().split(/\s+/))
    .filter((token) => token.length > 2);

  const uriTokens = normalizeSemanticTokens(uri)
    .split(/\s+/)
    .filter((token) => token.length > 2);

  const deduped = new Set<string>([...transcriptTokens, ...uriTokens]);
  return deduped.size === 0 ? ["video", "scene", "timeline"] : [...deduped];
}

function selectSceneKeywords(keywordPool: readonly string[], sceneIndex: number): readonly string[] {
  if (keywordPool.length <= 3) {
    return keywordPool;
  }

  const start = sceneIndex % keywordPool.length;
  const selected: string[] = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const keyword = keywordPool[(start + offset) % keywordPool.length];
    if (keyword != null) {
      selected.push(keyword);
    }
  }
  return selected;
}

function buildKeyFrameTimeline(durationMs: number, intervalMs: number): readonly number[] {
  const timestamps: number[] = [];
  for (let cursor = 0; cursor < durationMs; cursor += intervalMs) {
    timestamps.push(cursor);
  }
  return timestamps.length === 0 ? [0] : timestamps;
}
