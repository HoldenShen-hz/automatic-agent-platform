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

import type { StreamEventFrame } from "../interface/channel-gateway/stream-bridge.js";
import { ValidationError } from "../contracts/errors.js";

/** VCR replay mode determining behavior when fixtures are missing */
export type VcrReplayMode = "fixture_only" | "vcr_replay" | "vcr_record";

/** A single message in a VCR request */
export interface VcrRequestMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** A request to replay or record */
export interface VcrReplayRequest {
  provider: string;
  model: string;
  messages: readonly VcrRequestMessage[];
  tools?: readonly string[];
  settings?: {
    temperature?: number;
    reasoningLevel?: string;
    topP?: number;
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
  public replay(request: VcrReplayRequest): RecordedInteraction {
    const requestFingerprint = buildRequestFingerprint(request);
    const interaction = this.interactionsByFingerprint.get(requestFingerprint);
    if (interaction == null) {
      throw new ValidationError("vcr.fixture_missing", "vcr.fixture_missing", {
        statusCode: 404,
        retryable: false,
      });
    }
    return interaction;
  }
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
    toolSignature: [...(request.tools ?? [])].sort().join(","),
    keyParameters: {
      ...(request.settings?.temperature != null ? { temperature: request.settings.temperature } : {}),
      ...(request.settings?.reasoningLevel ? { reasoningLevel: request.settings.reasoningLevel } : {}),
      ...(request.settings?.topP != null ? { topP: request.settings.topP } : {}),
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
    .replace(/\s+/g, " ")
    .trim();
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
