/**
 * Model Routing CLI
 *
 * This module provides a command-line interface for routing LLM requests to
 * appropriate model providers based on capabilities, health status, and governance
 * policies. It supports capability matching, risk-based routing, and fallback
 * lease handling for model selection.
 *
 * Environment Variables:
 *   - AA_CONFIG_ROOT: Path to configuration root (defaults to ./config)
 *   - AA_MODEL_ROUTE_CLASS: Route class (e.g., fast, balanced, capable)
 *   - AA_MODEL_ROUTE_RISK_LEVEL: Risk level for routing (low, medium, high)
 *   - AA_MODEL_ROUTE_PREFERRED_PROFILE: Preferred model profile name
 *   - AA_MODEL_ROUTE_PINNED_PROFILE: Pinned model profile name
 *   - AA_MODEL_ROUTE_STICKY_PROFILE: Sticky model profile for session continuity
 *   - AA_MODEL_ROUTE_TURN_ID: Turn identifier for tracking
 *   - AA_MODEL_ROUTE_FALLBACK_LEASE_JSON: JSON-encoded fallback lease configuration
 *   - AA_MODEL_ROUTE_MAX_INPUT_PER_1K_USD: Max input tokens per $1000 budget
 *   - AA_MODEL_ROUTE_REQUIRED_CAPABILITIES: Comma-separated required capabilities
 *   - AA_MODEL_ROUTE_ALLOW_STRONG_UPgrade: Allow upgrading to stronger models
 *   - AA_MODEL_HEALTH_JSON: JSON object mapping provider IDs to health summaries
 *   - AA_MODEL_ROUTE_GOVERNANCE_SNAPSHOT_JSON: Inline governance snapshot JSON
 *   - AA_MODEL_ROUTE_LOAD_GOVERNANCE_SNAPSHOT: Whether to load snapshot from DB
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for model routing architecture
 * @see {@link docs_zh/contracts/model_routing_contract.md} for routing contracts
 */
export {};
