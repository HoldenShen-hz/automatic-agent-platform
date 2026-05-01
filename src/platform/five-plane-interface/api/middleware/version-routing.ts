/**
 * API Version Routing Middleware
 *
 * Implements §6.4 Accept-Version header routing for API version negotiation.
 */

export interface VersionRoutingConfig {
  /** Supported API versions in order of preference */
  supportedVersions: readonly string[];
  /** Default version when no version is specified */
  defaultVersion: string;
  /** Minimum supported version */
  minimumVersion: string;
}

/**
 * Default version routing configuration.
 */
export const DEFAULT_VERSION_ROUTING_CONFIG: VersionRoutingConfig = {
  supportedVersions: ["2026-04-01", "2026-01-01"],
  defaultVersion: "2026-04-01",
  minimumVersion: "2026-01-01",
};

/**
 * Version routing decision.
 */
export interface VersionRoutingDecision {
  /** Whether version is acceptable */
  acceptable: boolean;
  /** Selected version */
  version: string;
  /** Status code: 200 if acceptable, 400 or 406 if not */
  statusCode: 200 | 406 | 400;
  /** Reason code */
  reasonCode: string;
  /** Warning messages */
  warnings: readonly string[];
}

/**
 * API Version Routing Middleware per §6.4.
 * Handles Accept-Version header for API version negotiation.
 */
export class VersionRoutingMiddleware {
  private readonly config: VersionRoutingConfig;

  public constructor(config: Partial<VersionRoutingConfig> = {}) {
    this.config = { ...DEFAULT_VERSION_ROUTING_CONFIG, ...config };
  }

  /**
   * Parse Accept-Version header value.
   */
  public parseAcceptVersion(headerValue: string | null): string[] {
    if (headerValue == null || headerValue.trim().length === 0) {
      return [this.config.defaultVersion];
    }

    // Parse comma-separated versions
    const versions = headerValue
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    if (versions.length === 0) {
      return [this.config.defaultVersion];
    }

    return versions;
  }

  /**
   * Select the best version from Accept-Version header.
   * Uses quality values for preference ordering.
   */
  public selectVersion(acceptVersions: string[]): VersionRoutingDecision {
    if (acceptVersions.length === 0) {
      return {
        acceptable: true,
        version: this.config.defaultVersion,
        statusCode: 200,
        reasonCode: "version.default",
        warnings: [],
      };
    }

    const warnings: string[] = [];

    for (const requested of acceptVersions) {
      // Check if exact version is supported
      if (this.config.supportedVersions.includes(requested)) {
        return {
          acceptable: true,
          version: requested,
          statusCode: 200,
          reasonCode: "version.acceptable",
          warnings,
        };
      }

      // Check for version with q-value (e.g., "2026-04-01; q=0.9")
      const qIndex = requested.indexOf(";");
      if (qIndex !== -1) {
        const versionPart = requested.substring(0, qIndex).trim();
        if (this.config.supportedVersions.includes(versionPart)) {
          return {
            acceptable: true,
            version: versionPart,
            statusCode: 200,
            reasonCode: "version.acceptable",
            warnings,
          };
        }
      }

      warnings.push(`version_not_supported:${requested}`);
    }

    // Check if any requested version is below minimum
    const firstVersion = acceptVersions[0]!.split(";")[0]!.trim();
    if (this.compareVersions(firstVersion, this.config.minimumVersion) < 0) {
      return {
        acceptable: false,
        version: "",
        statusCode: 400,
        reasonCode: "version.below_minimum",
        warnings,
      };
    }

    // Return lowest supported version as fallback
    return {
      acceptable: true,
      version: this.config.supportedVersions[this.config.supportedVersions.length - 1]!,
      statusCode: 200,
      reasonCode: "version.fallback",
      warnings,
    };
  }

  /**
   * Compare two version strings.
   * @returns negative if left < right, 0 if equal, positive if left > right
   */
  private compareVersions(left: string, right: string): number {
    const leftParts = left.split("-");
    const rightParts = right.split("-");

    for (let i = 0; i < Math.max(leftParts.length, rightParts.length); i++) {
      const leftNum = Number.parseInt(leftParts[i] ?? "0", 10);
      const rightNum = Number.parseInt(rightParts[i] ?? "0", 10);
      if (leftNum !== rightNum) {
        return leftNum - rightNum;
      }
    }
    return 0;
  }

  /**
   * Check if a version is supported.
   */
  public isVersionSupported(version: string): boolean {
    return this.config.supportedVersions.includes(version);
  }

  /**
   * Get supported versions.
   */
  public getSupportedVersions(): readonly string[] {
    return this.config.supportedVersions;
  }
}

/**
 * Global version routing middleware instance.
 */
export const globalVersionRoutingMiddleware = new VersionRoutingMiddleware();