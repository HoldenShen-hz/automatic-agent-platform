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
import { ValidationError } from "../../contracts/errors.js";
/**
 * VCR Fixture Store
 *
 * Manages recorded interactions indexed by request fingerprint.
 * Provides replay functionality for deterministic testing.
 */
export class VcrFixtureStore {
    mode;
    interactionsByFingerprint = new Map();
    constructor(interactions = [], mode = "vcr_replay") {
        this.mode = mode;
        interactions.forEach((interaction) => this.recordInteraction(interaction));
    }
    /**
     * Loads recorded interactions from a fixture file or object.
     * Accepts either an array directly or an object with an "interactions" property.
     */
    static loadFixture(value) {
        const candidate = value != null &&
            typeof value === "object" &&
            "interactions" in value &&
            Array.isArray(value.interactions)
            ? value.interactions
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
    createInteraction(input) {
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
    recordInteraction(interaction) {
        const validated = validateRecordedInteraction(interaction);
        this.interactionsByFingerprint.set(validated.requestFingerprint, validated);
        return validated;
    }
    /**
     * Replays a recorded interaction for a request.
     * Looks up by request fingerprint.
     * Throws if no matching fixture found.
     */
    replay(request) {
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
export function buildRequestFingerprint(request) {
    const summary = buildRequestSummary(request);
    return createHash("sha256")
        .update(JSON.stringify({
        provider: request.provider,
        model: request.model,
        messages: summary.messages,
        toolSignature: summary.toolSignature,
        keyParameters: summary.keyParameters,
    }))
        .digest("hex");
}
/**
 * Builds a request summary from a VCR request.
 * Normalizes content and extracts key parameters for fingerprinting.
 */
function buildRequestSummary(request) {
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
function normalizePromptText(content) {
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
function validateRecordedInteraction(value) {
    if (value == null || typeof value !== "object") {
        throw new ValidationError("vcr.fixture_schema_invalid", "vcr.fixture_schema_invalid", {
            retryable: false,
        });
    }
    const candidate = value;
    if (typeof candidate.interactionId !== "string" ||
        typeof candidate.provider !== "string" ||
        typeof candidate.model !== "string" ||
        typeof candidate.requestFingerprint !== "string" ||
        candidate.requestSummary == null ||
        typeof candidate.requestSummary !== "object" ||
        candidate.responsePayload == null ||
        typeof candidate.responsePayload !== "object" ||
        typeof candidate.recordedAt !== "string") {
        throw new ValidationError("vcr.fixture_schema_invalid", "vcr.fixture_schema_invalid", {
            retryable: false,
        });
    }
    return {
        interactionId: candidate.interactionId,
        provider: candidate.provider,
        model: candidate.model,
        requestFingerprint: candidate.requestFingerprint,
        requestSummary: candidate.requestSummary,
        responsePayload: candidate.responsePayload,
        ...(Array.isArray(candidate.streamChunks) ? { streamChunks: candidate.streamChunks } : {}),
        ...(candidate.usageSnapshot != null && typeof candidate.usageSnapshot === "object"
            ? { usageSnapshot: candidate.usageSnapshot }
            : {}),
        recordedAt: candidate.recordedAt,
    };
}
//# sourceMappingURL=vcr-replay-fixture.js.map