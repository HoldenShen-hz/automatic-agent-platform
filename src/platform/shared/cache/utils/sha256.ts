import { createHash } from "node:crypto";

const SHA256_HEX_LENGTH = 64;
const DEFAULT_IDENTIFIER_HEX_LENGTH = 32;
const SIGNED_BIGINT_63_MASK = (1n << 63n) - 1n;

export function sha256Hex(value: string | Buffer, encoding?: BufferEncoding): string {
  const hash = createHash("sha256");
  if (typeof value === "string") {
    if (encoding == null) {
      hash.update(value);
    } else {
      hash.update(value, encoding);
    }
  } else {
    hash.update(value);
  }
  return hash.digest("hex");
}

export function sha256HexPrefix(
  value: string | Buffer,
  length: number = DEFAULT_IDENTIFIER_HEX_LENGTH,
  encoding?: BufferEncoding,
): string {
  const normalizedLength = Math.max(1, Math.min(SHA256_HEX_LENGTH, Math.trunc(length)));
  return sha256Hex(value, encoding).slice(0, normalizedLength);
}

export function sha256FoldToUint64(value: string | Buffer, encoding?: BufferEncoding): bigint {
  const hash = createHash("sha256");
  if (typeof value === "string") {
    if (encoding == null) {
      hash.update(value);
    } else {
      hash.update(value, encoding);
    }
  } else {
    hash.update(value);
  }
  const digest = hash.digest();
  let folded = 0n;
  for (let offset = 0; offset < digest.length; offset += 8) {
    folded ^= digest.readBigUInt64BE(offset);
  }
  return folded;
}

export function sha256FoldToSignedBigInt63(value: string | Buffer, encoding?: BufferEncoding): bigint {
  return sha256FoldToUint64(value, encoding) & SIGNED_BIGINT_63_MASK;
}
