import { createHash } from "node:crypto";
import { basename } from "node:path";
export function extractVideoMetadata(videoUri) {
    const fileName = basename(videoUri);
    const resolutionMatch = fileName.match(/(\d{3,4})x(\d{3,4})/);
    const durationMatch = fileName.match(/(\d+)(ms|s|m)/);
    const codecMatch = fileName.match(/\.(mp4|mov|webm|mkv)$/i);
    const durationMs = durationMatch == null
        ? 30_000
        : durationMatch[2] === "ms"
            ? Number(durationMatch[1])
            : durationMatch[2] === "m"
                ? Number(durationMatch[1]) * 60_000
                : Number(durationMatch[1]) * 1_000;
    return {
        durationMs,
        width: resolutionMatch == null ? 1280 : Number(resolutionMatch[1]),
        height: resolutionMatch == null ? 720 : Number(resolutionMatch[2]),
        codec: codecMatch?.[1]?.toLowerCase() ?? "h264",
    };
}
export function transcribeVideo(videoUri) {
    const normalized = basename(videoUri)
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .replace(/\b\d+(?:ms|s|m)?\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    return normalized.length > 0 ? normalized : "video transcript unavailable";
}
export function extractVideoKeyFrames(videoUri, intervalSeconds) {
    const metadata = extractVideoMetadata(videoUri);
    const intervalMs = Math.max(1, Math.trunc(intervalSeconds)) * 1_000;
    const keyFrames = [];
    for (let timestampMs = 0; timestampMs < metadata.durationMs; timestampMs += intervalMs) {
        keyFrames.push({
            timestampMs,
            imageData: `frame:${timestampMs}:${createHash("sha1").update(`${videoUri}:${timestampMs}`).digest("hex").slice(0, 12)}`,
        });
    }
    if (keyFrames.length === 0) {
        keyFrames.push({
            timestampMs: 0,
            imageData: `frame:0:${createHash("sha1").update(videoUri).digest("hex").slice(0, 12)}`,
        });
    }
    return keyFrames;
}
export class VideoProcessor {
    processVideo(videoContent) {
        const metadata = videoContent.metadata ?? extractVideoMetadata(videoContent.uri);
        const transcript = transcribeVideo(videoContent.uri);
        const keyFrames = extractVideoKeyFrames(videoContent.uri, 10);
        return { metadata, transcript, keyFrames };
    }
}
//# sourceMappingURL=index.js.map