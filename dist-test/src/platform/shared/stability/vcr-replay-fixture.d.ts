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
import type { StreamEventFrame } from "../../interface/channel-gateway/stream-bridge.js";
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
        messages: {
            role: string;
            content: string;
        }[];
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
export declare class VcrFixtureStore {
    readonly mode: VcrReplayMode;
    private readonly interactionsByFingerprint;
    constructor(interactions?: readonly RecordedInteraction[], mode?: VcrReplayMode);
    /**
     * Loads recorded interactions from a fixture file or object.
     * Accepts either an array directly or an object with an "interactions" property.
     */
    static loadFixture(value: unknown): RecordedInteraction[];
    /**
     * Creates and validates a new recorded interaction.
     */
    createInteraction(input: {
        interactionId: string;
        request: VcrReplayRequest;
        responsePayload: Record<string, unknown>;
        streamChunks?: StreamEventFrame[];
        usageSnapshot?: Record<string, unknown>;
        recordedAt?: string;
    }): RecordedInteraction;
    /**
     * Records an interaction into the store.
     */
    recordInteraction(interaction: RecordedInteraction): RecordedInteraction;
    /**
     * Replays a recorded interaction for a request.
     * Looks up by request fingerprint.
     * Throws if no matching fixture found.
     */
    replay(request: VcrReplayRequest): RecordedInteraction;
}
/**
 * Builds a SHA-256 fingerprint for a request.
 * The fingerprint uniquely identifies the request for replay lookup.
 */
export declare function buildRequestFingerprint(request: VcrReplayRequest): string;
