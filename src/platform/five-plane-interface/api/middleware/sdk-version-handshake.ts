export interface SdkVersionHandshakePolicy {
  readonly platformVersion: string;
  readonly contractVersion: string;
  readonly minimumSdkVersion: string;
  readonly recommendedSdkVersion?: string;
}

export interface SdkVersionHandshakeRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface SdkVersionHandshakeDecision {
  readonly accepted: boolean;
  readonly statusCode: 200 | 426;
  readonly reasonCode: "sdk.accepted" | "sdk.upgrade_required";
  readonly responseHeaders: Readonly<Record<string, string>>;
  readonly warnings: readonly string[];
}

export class SdkVersionHandshakeService {
  public constructor(private readonly policy: SdkVersionHandshakePolicy) {}

  public evaluate(request: SdkVersionHandshakeRequest): SdkVersionHandshakeDecision {
    const sdkVersion = this.header(request.headers, "x-sdk-version");
    const contractVersion = this.header(request.headers, "x-contract-version");
    const warnings: string[] = [];

    if (contractVersion != null && contractVersion !== this.policy.contractVersion) {
      warnings.push(`compatibility_warning:contract=${contractVersion};expected=${this.policy.contractVersion}`);
    }

    if (sdkVersion == null || this.compareSemver(sdkVersion, this.policy.minimumSdkVersion) < 0) {
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
}
