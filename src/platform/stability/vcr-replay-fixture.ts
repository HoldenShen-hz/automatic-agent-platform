/**
 * VCR Replay Fixture Module
 *
 * Provides VCR (Video Cassette Recorder) pattern replay functionality for deterministic
 * test fixture playback. Records and replays LLM provider interactions to achieve
 * reproducible testing outcomes.
 *
 * Key concepts:
 * - Request fingerprinting: SHA-256 hash of provider, model, messages, tools, and settings
 * - Fixture storage: Request/response pairs indexed by fingerprint
 * - Three replay modes:
 *   - fixture_only: Use only stored fixtures, no live calls
 *   - vcr_replay: Require fixture, error if missing
 *   - vcr_record: Record new interactions if fixture missing
 *
 * The fingerprint is built from:
 * - Provider name
 * - Model name
 * - Normalized message content (secrets redacted)
 * - Sorted tool signature (tool names joined)
 * - Key parameters (temperature, reasoningLevel, topP)
 *
 * @see docs_zh/contracts/vcr_and_fixture_testing_contract.md for fixture schema
 * @see docs_zh/architecture/00-platform-architecture.md for testing infrastructure
 * @see docs_zh/governance/glossary_and_terminology.md for VCR terminology
 */

import { createHash } from "node:crypto";

import type { StreamEventFrame } from "../five-plane-interface/channel-gateway/stream-bridge.js";
import { ValidationError } from "../contracts/errors.js";

/** VCR replay mode determining behavior when fixtures are missing */
export type VcrReplayMode = "fixture_only" | "vcr_replay" | "vcr_record";

/** A single message in a VCR request */
export interface VcrRequestMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** A request to replay or record */
export interface VcrToolDescriptor {
  name: string;
  version?: string;
  schemaHash?: string;
  inputSchema?: unknown;
}

export interface VcrReplayRequest {
  provider: string;
  model: string;
  messages: readonly VcrRequestMessage[];
  tools?: readonly (string | VcrToolDescriptor)[];
  settings?: {
    temperature?: number;
    reasoningLevel?: string;
    topP?: number;
    seed?: number;
    maxTokens?: number;
    stop?: string | readonly string[];
    topK?: number;
    responseFormat?: string | Record<string, unknown>;
  };
}

/** A complete recorded interaction with request and response */
export interface RecordedInteraction {
  interactionId: string;
  provider: string;
  model: string;
  requestFingerprint: string;
  /** Summary of the request for debugging/inspection */
  requestSummary: {
    messages: { role: string; content: string }[];
    toolSignature: string;
    keyParameters: Record<string, unknown>;
  };
  responsePayload: Record<string, unknown>;
  streamChunks?: StreamEventFrame[];
  usageSnapshot?: Record<string, unknown>;
  recordedAt: string;
}

export interface VcrReplayFixtureOptions {
  fixtureId: string;
  outputDir: string;
  seed?: number;
}

export interface VcrReplayEvent {
  eventType: string;
  timestamp: string;
  payload: unknown;
}

export interface VcrReplayRecording {
  fixtureId: string;
  recordedAt: string;
  durationMs: number;
  events: VcrReplayEvent[];
  metadata: Record<string, unknown>;
}

export interface VcrReplayFixture {
  fixtureId: string;
  outputDir: string;
  seed: number | null;
  replay(recording: VcrReplayRecording): VcrReplayEvent[];
  record(input: Omit<VcrReplayRecording, "fixtureId">): VcrReplayRecording;
}

/**
 * VCR Fixture Store
 *
 * Manages recorded interactions indexed by request fingerprint.
 * Provides replay functionality for deterministic testing.
 */
export class VcrFixtureStore {
  private readonly interactionsByFingerprint = new Map<string, RecordedInteraction>();

  public constructor(
    interactions: readonly RecordedInteraction[] = [],
    public readonly mode: VcrReplayMode = "vcr_replay",
  ) {
    interactions.forEach((interaction) => this.recordInteraction(interaction));
  }

  /**
   * Loads recorded interactions from a fixture file or object.
   * Accepts either an array directly or an object with an "interactions" property.
   */
  public static loadFixture(value: unknown): RecordedInteraction[] {
    const candidate =
      value != null &&
      typeof value === "object" &&
      "interactions" in value &&
      Array.isArray((value as { interactions?: unknown }).interactions)
        ? (value as { interactions: unknown[] }).interactions
        : Array.isArray(value)
          ? value
          : null;

    if (candidate == null) {
      throw new ValidationError("vcr.fixture_schema_invalid", "vcr.fixture_schema_invalid", {
        retryable: false,
      });
    }

    return candidate.map(validateRecordedInteraction);
  }

  /**
   * Creates and validates a new recorded interaction.
   */
  public createInteraction(input: {
    interactionId: string;
    request: VcrReplayRequest;
    responsePayload: Record<string, unknown>;
    streamChunks?: StreamEventFrame[];
    usageSnapshot?: Record<string, unknown>;
    recordedAt?: string;
  }): RecordedInteraction {
    return validateRecordedInteraction({
      interactionId: input.interactionId,
      provider: input.request.provider,
      model: input.request.model,
      requestFingerprint: buildRequestFingerprint(input.request),
      requestSummary: buildRequestSummary(input.request),
      responsePayload: input.responsePayload,
      ...(input.streamChunks ? { streamChunks: [...input.streamChunks] } : {}),
      ...(input.usageSnapshot ? { usageSnapshot: input.usageSnapshot } : {}),
      recordedAt: input.recordedAt ?? new Date().toISOString(),
    });
  }

  /**
   * Records an interaction into the store.
   */
  public recordInteraction(interaction: RecordedInteraction): RecordedInteraction {
    const validated = validateRecordedInteraction(interaction);
    this.interactionsByFingerprint.set(validated.requestFingerprint, validated);
    return validated;
  }

  /**
   * Replays a recorded interaction for a request.
   * Looks up by request fingerprint.
   * Throws if no matching fixture found.
   */
  public replay(
    request: VcrReplayRequest,
    options?: {
      record?: () => Omit<RecordedInteraction, "provider" | "model" | "requestFingerprint" | "requestSummary">;
    },
  ): RecordedInteraction {
    const requestFingerprint = buildRequestFingerprint(request);
    const interaction = this.interactionsByFingerprint.get(requestFingerprint);
    if (interaction != null) {
      return interaction;
    }
    if (this.mode === "vcr_record" && options?.record != null) {
      const recorded = validateRecordedInteraction({
        ...options.record(),
        provider: request.provider,
        model: request.model,
        requestFingerprint,
        requestSummary: buildRequestSummary(request),
      });
      this.recordInteraction(recorded);
      return recorded;
    }
    if (interaction == null) {
      throw new ValidationError("vcr.fixture_missing", "vcr.fixture_missing", {
        statusCode: 404,
        retryable: false,
      });
    }
    return interaction;
  }
}

export function buildVcrReplayFixture(options: VcrReplayFixtureOptions): VcrReplayFixture {
  return {
    fixtureId: options.fixtureId,
    outputDir: options.outputDir,
    seed: options.seed ?? null,
    replay(recording) {
      const validation = validateVcrReplayRecording(recording);
      if (!validation.valid) {
        throw new ValidationError("vcr.replay_recording_invalid", validation.errors.join("; "), {
          retryable: false,
        });
      }
      return replayEventsWithDeterministicSeed(recording.events, recording.recordedAt, options.seed ?? null);
    },
    record(input) {
      return createVcrReplayRecording({
        ...input,
        fixtureId: options.fixtureId,
        metadata: {
          ...(options.seed != null ? { replaySeed: options.seed } : {}),
          ...input.metadata,
        },
      });
    },
  };
}

function replayEventsWithDeterministicSeed(
  events: readonly VcrReplayEvent[],
  recordedAt: string,
  seed: number | null,
): VcrReplayEvent[] {
  const cloned = events.map((event) => ({
    ...event,
    payload: cloneReplayPayload(event.payload),
  }));
  if (seed == null) {
    return cloned;
  }
  const rng = createSeededReplayRandom(seed);
  const baseSeedOffsetMs = Math.abs(Math.trunc(seed)) % 17;
  const recordedAtMs = Number.isNaN(Date.parse(recordedAt))
    ? Date.parse("2026-01-01T00:00:00.000Z")
    : Date.parse(recordedAt);
  let lastTimestampMs = recordedAtMs - 1;
  return cloned.map((event, index) => {
    const eventTimestampMs = Date.parse(event.timestamp);
    const relativeBaseMs = Number.isNaN(eventTimestampMs)
      ? recordedAtMs + index
      : recordedAtMs + Math.max(0, eventTimestampMs - recordedAtMs);
    const replayTimestampMs = Math.max(
      lastTimestampMs + 1,
      relativeBaseMs + baseSeedOffsetMs + Math.floor(rng() * 5),
    );
    lastTimestampMs = replayTimestampMs;
    return {
      ...event,
      timestamp: new Date(replayTimestampMs).toISOString(),
    };
  });
}

function cloneReplayPayload(payload: unknown): unknown {
  if (payload == null || typeof payload !== "object") {
    return payload;
  }
  return JSON.parse(JSON.stringify(payload));
}

function createSeededReplayRandom(seed: number): () => number {
  let state = (Math.trunc(seed) >>> 0) || 0x9e3779b9;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function createVcrReplayRecording(input: VcrReplayRecording): VcrReplayRecording {
  return {
    fixtureId: input.fixtureId,
    recordedAt: input.recordedAt,
    durationMs: input.durationMs,
    events: input.events.map((event) => ({ ...event })),
    metadata: { ...input.metadata },
  };
}

export function validateVcrReplayRecording(recording: VcrReplayRecording): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof recording.fixtureId !== "string" || recording.fixtureId.length === 0) {
    errors.push("fixtureId is required");
  }
  if (typeof recording.recordedAt !== "string" || Number.isNaN(Date.parse(recording.recordedAt))) {
    errors.push("recordedAt must be an ISO timestamp");
  }
  if (!Number.isFinite(recording.durationMs) || recording.durationMs < 0) {
    errors.push("durationMs must be non-negative");
  }
  if (!Array.isArray(recording.events)) {
    errors.push("events must be an array");
  } else {
    recording.events.forEach((event, index) => {
      if (typeof event.eventType !== "string" || event.eventType.length === 0) {
        errors.push(`events[${index}].eventType is required`);
      }
      if (typeof event.timestamp !== "string" || Number.isNaN(Date.parse(event.timestamp))) {
        errors.push(`events[${index}].timestamp must be an ISO timestamp`);
      }
    });
  }
  if (recording.metadata == null || typeof recording.metadata !== "object" || Array.isArray(recording.metadata)) {
    errors.push("metadata must be an object");
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Builds a SHA-256 fingerprint for a request.
 * The fingerprint uniquely identifies the request for replay lookup.
 */
export function buildRequestFingerprint(request: VcrReplayRequest): string {
  const summary = buildRequestSummary(request);
  return createHash("sha256")
    .update(
      JSON.stringify({
        provider: request.provider,
        model: request.model,
        messages: summary.messages,
        toolSignature: summary.toolSignature,
        keyParameters: summary.keyParameters,
      }),
    )
    .digest("hex");
}

/**
 * Builds a request summary from a VCR request.
 * Normalizes content and extracts key parameters for fingerprinting.
 */
function buildRequestSummary(request: VcrReplayRequest): RecordedInteraction["requestSummary"] {
  return {
    messages: request.messages.map((message) => ({
      role: message.role,
      content: normalizePromptText(message.content),
    })),
    toolSignature: buildToolSignature(request.tools),
    keyParameters: {
      ...(request.settings?.temperature != null ? { temperature: request.settings.temperature } : {}),
      ...(request.settings?.reasoningLevel ? { reasoningLevel: request.settings.reasoningLevel } : {}),
      ...(request.settings?.topP != null ? { topP: request.settings.topP } : {}),
      ...(request.settings?.seed != null ? { seed: request.settings.seed } : {}),
      ...(request.settings?.maxTokens != null ? { maxTokens: request.settings.maxTokens } : {}),
      ...(request.settings?.stop != null ? { stop: normalizeStopSequences(request.settings.stop) } : {}),
      ...(request.settings?.topK != null ? { topK: request.settings.topK } : {}),
      ...(request.settings?.responseFormat != null ? { responseFormat: stableSerialize(request.settings.responseFormat) } : {}),
    },
  };
}

/**
 * Normalizes prompt text by redacting secrets and normalizing whitespace.
 * Replaces authorization headers, API keys, and tokens with placeholders.
 */
function normalizePromptText(content: string): string {
  return content
    .replace(/authorization\s*:\s*bearer\s+\S+/gi, "authorization:bearer <redacted>")
    .replace(/api[_-]?key\s*[:=]\s*\S+/gi, "api_key=<redacted>")
    .replace(/token\s*[:=]\s*\S+/gi, "token=<redacted>")
    .replace(/x[-_][a-z0-9_-]*key\s*[:=]\s*\S+/gi, "x-key=<redacted>")
    .replace(/"(secret|api[_-]?key|token|x[-_][a-z0-9_-]*key)"\s*:\s*"[^"]*"/gi, "\"$1\":\"<redacted>\"")
    .replace(/\s+/g, " ")
    .trim();
}

function buildToolSignature(tools: readonly (string | VcrToolDescriptor)[] | undefined): string {
  return [...(tools ?? [])]
    .map((tool) => normalizeToolDescriptor(tool))
    .sort()
    .join(",");
}

function normalizeToolDescriptor(tool: string | VcrToolDescriptor): string {
  if (typeof tool === "string") {
    return tool.trim();
  }
  const schemaFingerprint = tool.schemaHash
    ?? (tool.inputSchema != null ? createHash("sha256").update(stableSerialize(tool.inputSchema)).digest("hex").slice(0, 12) : "");
  return [
    tool.name.trim(),
    tool.version?.trim() ?? "",
    schemaFingerprint,
  ].filter((part) => part.length > 0).join("@");
}

function normalizeStopSequences(stop: string | readonly string[]): readonly string[] {
  return (Array.isArray(stop) ? [...stop] : [stop]).map((item) => item.trim()).sort();
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (value != null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Validates and type-guards a recorded interaction object.
 * Throws if validation fails.
 */
function validateRecordedInteraction(value: unknown): RecordedInteraction {
  if (value == null || typeof value !== "object") {
    throw new ValidationError("vcr.fixture_schema_invalid", "vcr.fixture_schema_invalid", {
      retryable: false,
    });
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.interactionId !== "string" ||
    typeof candidate.provider !== "string" ||
    typeof candidate.model !== "string" ||
    typeof candidate.requestFingerprint !== "string" ||
    candidate.requestSummary == null ||
    typeof candidate.requestSummary !== "object" ||
    candidate.responsePayload == null ||
    typeof candidate.responsePayload !== "object" ||
    typeof candidate.recordedAt !== "string"
  ) {
    throw new ValidationError("vcr.fixture_schema_invalid", "vcr.fixture_schema_invalid", {
      retryable: false,
    });
  }

  return {
    interactionId: candidate.interactionId,
    provider: candidate.provider,
    model: candidate.model,
    requestFingerprint: candidate.requestFingerprint,
    requestSummary: candidate.requestSummary as RecordedInteraction["requestSummary"],
    responsePayload: candidate.responsePayload as Record<string, unknown>,
    ...(Array.isArray(candidate.streamChunks) ? { streamChunks: candidate.streamChunks as StreamEventFrame[] } : {}),
    ...(candidate.usageSnapshot != null && typeof candidate.usageSnapshot === "object"
      ? { usageSnapshot: candidate.usageSnapshot as Record<string, unknown> }
      : {}),
    recordedAt: candidate.recordedAt,
  };
}
