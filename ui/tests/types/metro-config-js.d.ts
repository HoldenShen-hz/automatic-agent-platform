declare module "../../../../../apps/mobile/metro.config.js" {
  const metroConfig: {
    projectRoot: string;
    watchFolders: string[];
    resolver: {
      sourceExts: string[];
      nodeModulesPaths: string[];
      unstable_enablePackageExports?: boolean;
    };
  };

  export default metroConfig;
}
