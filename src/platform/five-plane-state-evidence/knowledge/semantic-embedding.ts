import { createHash } from "node:crypto";

import { sha256HexPrefix } from "../../shared/cache/utils/sha256.js";

const VECTOR_DIMENSIONS = 32;

const SEMANTIC_SYNONYMS: Record<string, string> = {
  builds: "build",
  building: "build",
  compile: "build",
  compiled: "build",
  compiler: "build",
  compilation: "build",
  compiling: "build",
  retries: "retry",
  retrying: "retry",
  caches: "cache",
  cached: "cache",
  lockfiles: "lockfile",
  dependencies: "dependency",
  packages: "package",
  failures: "failure",
  failing: "failure",
};

function stableHash(token: string): number {
  const digest = createHash("sha256").update(token, "utf8").digest();
  return digest.readUInt32BE(0);
}

function canonicalizeToken(token: string): string {
  const normalized = token.trim().toLowerCase();
  if (normalized.length === 0) {
    return normalized;
  }
  const synonym = SEMANTIC_SYNONYMS[normalized];
  if (synonym) {
    return synonym;
  }
  if (normalized.endsWith("ation") && normalized.length > 7) {
    return `${normalized.slice(0, -5)}e`;
  }
  if (normalized.endsWith("ing") && normalized.length > 5) {
    return normalized.slice(0, -3);
  }
  if (normalized.endsWith("ed") && normalized.length > 4) {
    return normalized.slice(0, -2);
  }
  if (normalized.endsWith("es") && normalized.length > 4) {
    return normalized.slice(0, -2);
  }
  if (normalized.endsWith("s") && normalized.length > 4) {
    return normalized.slice(0, -1);
  }
  return normalized;
}

export function tokenizeSemantically(input: string): string[] {
  const rawTokens = input
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .map((token) => canonicalizeToken(token))
    .filter((token) => token.length >= 3 || /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(token));
  return Array.from(new Set(rawTokens));
}

function tokenFeatures(token: string): Array<{ feature: string; weight: number }> {
  const features: Array<{ feature: string; weight: number }> = [{ feature: `tok:${token}`, weight: 1 }];
  if (token.length >= 4) {
    for (let index = 0; index <= token.length - 3; index++) {
      features.push({
        feature: `tri:${token.slice(index, index + 3)}`,
        weight: 0.3,
      });
    }
  }
  return features;
}

export function buildSemanticEmbedding(input: string, extraTerms: readonly string[] = []): number[] | null {
  const tokens = [
    ...tokenizeSemantically(input),
    ...extraTerms.flatMap((term) => tokenizeSemantically(term)),
  ];
  if (tokens.length === 0) {
    return null;
  }

  const vector = new Array<number>(VECTOR_DIMENSIONS).fill(0);
  for (const token of tokens) {
    for (const feature of tokenFeatures(token)) {
      const hash = stableHash(feature.feature);
      const index = hash % VECTOR_DIMENSIONS;
      const sign = ((hash >> 8) & 1) === 0 ? 1 : -1;
      vector[index] = (vector[index] ?? 0) + (feature.weight * sign);
    }
  }
  return normalizeVector(vector);
}

export function semanticEmbeddingId(input: string, extraTerms: readonly string[] = []): string | null {
  const tokens = [
    ...tokenizeSemantically(input),
    ...extraTerms.flatMap((term) => tokenizeSemantically(term)),
  ].sort();
  if (tokens.length === 0) {
    return null;
  }
  return `local-hash-v1:${sha256HexPrefix(tokens.join("|"), 32, "utf8")}`;
}

export function cosineSimilarity(left: readonly number[] | null, right: readonly number[] | null): number {
  if (!left || !right || left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index++) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

function normalizeVector(vector: readonly number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((total, value) => total + (value * value), 0));
  if (magnitude === 0) {
    return [...vector];
  }
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}
