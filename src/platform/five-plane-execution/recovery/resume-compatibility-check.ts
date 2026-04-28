export interface ResumeSnapshotDescriptor {
  readonly runId: string;
  readonly contractVersion: string;
  readonly runtimeVersion: string;
  readonly graphHash: string;
  readonly artifactLockHash: string;
}

export interface ResumeCompatibilityOptions {
  readonly timeoutMs: number;
  readonly startedAtMs: number;
  readonly nowMs: number;
}

export interface ResumeDiffReport {
  readonly compatible: boolean;
  readonly timedOut: boolean;
  readonly differences: readonly {
    readonly field: keyof ResumeSnapshotDescriptor;
    readonly before: string;
    readonly after: string;
  }[];
}

export class ResumeCompatibilityCheck {
  public compare(
    before: ResumeSnapshotDescriptor,
    after: ResumeSnapshotDescriptor,
    options: ResumeCompatibilityOptions,
  ): ResumeDiffReport {
    if (options.nowMs - options.startedAtMs > options.timeoutMs) {
      return {
        compatible: false,
        timedOut: true,
        differences: [],
      };
    }

    const fields: readonly (keyof ResumeSnapshotDescriptor)[] = [
      "runId",
      "contractVersion",
      "runtimeVersion",
      "graphHash",
      "artifactLockHash",
    ];
    const differences = fields
      .filter((field) => before[field] !== after[field])
      .map((field) => ({
        field,
        before: before[field],
        after: after[field],
      }));

    return {
      compatible: differences.length === 0,
      timedOut: false,
      differences,
    };
  }
}
