/**
 * Risk configuration loader
 * Loads risk matrix from config/risk/default.json
 */
import { type SandboxPolicy } from "../iam/sandbox-policy.js";
import type { RiskConfig } from "./types.js";
/**
 * Loads the risk configuration from the JSON config file.
 *
 * @param configPath - Optional path to config file (defaults to config/risk/default.json)
 * @param sandboxPolicy - Optional sandbox policy for path validation
 * @returns The parsed risk configuration
 */
export declare function loadRiskConfig(configPath?: string, sandboxPolicy?: SandboxPolicy): RiskConfig;
