export interface OtelBootstrapConfig {
    enabled: boolean;
    endpoint: string | null;
    serviceName: string;
    serviceVersion: string;
    instrumentHttp: boolean;
}
export declare function isOtelRuntimeAvailable(requireFn?: NodeJS.Require): boolean;
export declare function initOtel(config: OtelBootstrapConfig): Promise<boolean>;
export declare function shutdownOtel(): Promise<void>;
