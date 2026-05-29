import type { ConflictMetadata, ConflictResolutionStrategy } from "./types.js";
export declare class ConflictResolver {
    resolve<T>(serverValue: T, localValue: T, strategy?: ConflictResolutionStrategy, serverMetadata?: ConflictMetadata, localMetadata?: ConflictMetadata): T;
}
