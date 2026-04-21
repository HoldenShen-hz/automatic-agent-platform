/**
 * Risk configuration loader
 * Loads risk matrix from config/risk/default.json
 */
import type { RiskConfig } from "./types.js";
export declare function loadRiskConfig(configPath?: string): RiskConfig;
