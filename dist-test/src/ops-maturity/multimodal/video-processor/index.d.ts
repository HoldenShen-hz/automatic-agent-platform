export interface VideoMetadata {
    readonly durationMs: number;
    readonly width: number;
    readonly height: number;
    readonly codec: string;
}
export interface VideoKeyFrame {
    readonly timestampMs: number;
    readonly imageData: string;
}
export declare function extractVideoMetadata(videoUri: string): VideoMetadata;
export declare function transcribeVideo(videoUri: string): string;
export declare function extractVideoKeyFrames(videoUri: string, intervalSeconds: number): VideoKeyFrame[];
export declare class VideoProcessor {
    processVideo(videoContent: {
        uri: string;
        metadata?: VideoMetadata;
    }): {
        metadata: VideoMetadata;
        transcript: string;
        keyFrames: VideoKeyFrame[];
    };
}
