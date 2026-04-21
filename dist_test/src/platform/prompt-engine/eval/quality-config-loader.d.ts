/**
 * Quality Configuration Loader
 *
 * Loads quality gate configuration from config/quality/default.json
 */
import type { QualityGateConfig } from "./types.js";
export declare function loadQualityConfig(configPath?: string): QualityGateConfig;
