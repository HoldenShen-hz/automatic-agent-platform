import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

import { newId, nowIso } from "../../contracts/types/ids.js";
import type { ArtifactBundleExtended } from "./artifact-model.js";

export interface ArtifactPublishLedgerEntry {
  publishId: string;
  bundleId: string;
  taskId: string;
  domainId: string;
  bundleType: ArtifactBundleExtended["bundleType"];
  artifactCount: number;
  totalSize: number;
  publishedAt: string;
  publishStatus: ArtifactBundleExtended["publishStatus"];
  target?: string | null;
  destination?: string | null;
}

export interface ArtifactPublishLedgerOptions {
  ledgerPath?: string;
}

export class ArtifactPublishLedger {
  private readonly ledgerPath: string | null;
  private readonly entries: ArtifactPublishLedgerEntry[] = [];

  public constructor(options: ArtifactPublishLedgerOptions = {}) {
    this.ledgerPath = options.ledgerPath ?? null;
  }

  public record(bundle: ArtifactBundleExtended, metadata: { target?: string | null; destination?: string | null } = {}): ArtifactPublishLedgerEntry {
    const entry: ArtifactPublishLedgerEntry = {
      publishId: newId("artifact_publish"),
      bundleId: bundle.bundleId,
      taskId: bundle.taskId,
      domainId: bundle.domainId,
      bundleType: bundle.bundleType,
      artifactCount: bundle.artifacts.length,
      totalSize: bundle.totalSize,
      publishedAt: bundle.publishedAt ?? nowIso(),
      publishStatus: bundle.publishStatus,
      target: metadata.target ?? null,
      destination: metadata.destination ?? null,
    };
    this.entries.push(entry);
    if (this.ledgerPath) {
      mkdirSync(dirname(this.ledgerPath), { recursive: true });
      appendFileSync(this.ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
    }
    return entry;
  }

  public list(): ArtifactPublishLedgerEntry[] {
    if (!this.ledgerPath || !existsSync(this.ledgerPath)) {
      return [...this.entries];
    }
    const content = readFileSync(this.ledgerPath, "utf8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as ArtifactPublishLedgerEntry);
  }
}
