export interface SdkVersionHandshakePolicy {
  readonly platformVersion: string;
  readonly contractVersion: string;
  readonly minimumSdkVersion: string;
  readonly recommendedSdkVersion?: string;
  readonly platformMinimumVersion?: string;
}

export interface SdkVersionHandshakeRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface SdkVersionHandshakeDecision {
  readonly accepted: boolean;
  readonly statusCode: 200 | 426;
  readonly reasonCode: "sdk.accepted" | "sdk.upgrade_required" | "sdk.platform_incompatible";
  readonly responseHeaders: Readonly<Record<string, string>>;
  readonly warnings: readonly string[];
}

export class SdkVersionHandshakeService {
  public constructor(private readonly policy: SdkVersionHandshakePolicy) {}

  public evaluate(request: SdkVersionHandshakeRequest): SdkVersionHandshakeDecision {
    const sdkVersion = this.header(request.headers, "x-sdk-version");
    const contractVersion = this.header(request.headers, "x-contract-version");
    const platformMinVersion = this.header(request.headers, "x-platform-min-version");
    const warnings: string[] = [];

    if (contractVersion != null && contractVersion !== this.policy.contractVersion) {
      warnings.push(`compatibility_warning:contract=${contractVersion};expected=${this.policy.contractVersion}`);
    }

    // R5-53: Validate platform minimum version compatibility
    // R5-53 fix: Reject handshake if platform_min_version is below minimum, not just warn
    if (platformMinVersion != null && this.compareSemver(platformMinVersion, this.policy.platformVersion) > 0) {
      return {
        accepted: false,
        statusCode: 426,
        reasonCode: "sdk.platform_incompatible",
        responseHeaders: this.buildHeaders("platform_incompatible"),
        warnings: [
          `compatibility_error:platform_min=${platformMinVersion};platform=${this.policy.platformVersion}`,
          ...warnings,
        ],
      };
    }

    if (platformMinVersion != null && !this.isStrictSemver(platformMinVersion)) {
      return {
        accepted: false,
        statusCode: 426,
        reasonCode: "sdk.upgrade_required",
        responseHeaders: this.buildHeaders("upgrade_required"),
        warnings: [`compatibility_error:platform_min_invalid=${platformMinVersion}`, ...warnings],
      };
    }

    if (platformMinVersion != null && this.policy.platformMinimumVersion != null) {
      if (this.compareSemver(platformMinVersion, this.policy.platformMinimumVersion) < 0) {
        return {
          accepted: false,
          statusCode: 426,
          reasonCode: "sdk.upgrade_required",
          responseHeaders: this.buildHeaders("upgrade_required"),
          warnings: [
            `compatibility_error:platform_min=${platformMinVersion};required=${this.policy.platformMinimumVersion}`,
            ...warnings,
          ],
        };
      }
    }

    if (sdkVersion == null || !this.isStrictSemver(sdkVersion) || this.compareSemver(sdkVersion, this.policy.minimumSdkVersion) < 0) {
      return {
        accepted: false,
        statusCode: 426,
        reasonCode: "sdk.upgrade_required",
        responseHeaders: this.buildHeaders("upgrade_required"),
        warnings,
      };
    }

    const recommended = this.policy.recommendedSdkVersion;
    if (recommended != null && this.compareSemver(sdkVersion, recommended) < 0) {
      warnings.push(`compatibility_warning:sdk=${sdkVersion};recommended=${recommended}`);
    }

    return {
      accepted: true,
      statusCode: 200,
      reasonCode: "sdk.accepted",
      responseHeaders: this.buildHeaders(warnings.length > 0 ? "compatibility_warning" : "compatible"),
      warnings,
    };
  }

  private buildHeaders(status: string): Readonly<Record<string, string>> {
    return {
      "X-Platform-Version": this.policy.platformVersion,
      "X-Contract-Version": this.policy.contractVersion,
      "X-SDK-Compatibility": status,
    };
  }

  private header(headers: Readonly<Record<string, string | string[] | undefined>>, name: string): string | null {
    const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (found == null) {
      return null;
    }
    const value = found[1];
    return Array.isArray(value) ? (value[0] ?? null) : value ?? null;
  }

  private compareSemver(left: string, right: string): number {
    const leftParts = this.parse(left);
    const rightParts = this.parse(right);
    for (let index = 0; index < 3; index += 1) {
      const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
      if (delta !== 0) {
        return delta;
      }
    }
    return 0;
  }

  private parse(version: string): readonly number[] {
    return version.split(".").slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
  }

  private isStrictSemver(version: string): boolean {
    return /^\d+(?:\.\d+){0,2}$/.test(version.trim());
  }
}
