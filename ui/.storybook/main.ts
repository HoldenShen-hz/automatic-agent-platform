import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import webViteConfig, { buildCspHeader } from "../apps/web/vite.config";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: [
    "../packages/ui-core/src/**/*.stories.@(ts|tsx)",
    "../packages/features/*/src/**/*.stories.@(ts|tsx)",
    "../packages/shared/*/src/**/*.stories.@(ts|tsx)",
  ],
  staticDirs: ["../apps/web/public"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-viewport",
  ],
  async viteFinal(baseConfig) {
    const resolvedWebConfig = await webViteConfig({
      command: "serve",
      mode: process.env.NODE_ENV === "production" ? "production" : "development",
      isPreview: false,
      isSsrBuild: false,
    });
    return mergeConfig(baseConfig, {
      define: resolvedWebConfig.define,
      resolve: resolvedWebConfig.resolve,
      server: {
        ...(baseConfig.server ?? {}),
        headers: {
          ...baseConfig.server?.headers,
          "Content-Security-Policy": buildCspHeader(process.env as Record<string, string | undefined>),
        },
      },
      preview: {
        ...(baseConfig.preview ?? {}),
        headers: {
          ...baseConfig.preview?.headers,
          "Content-Security-Policy": buildCspHeader(process.env as Record<string, string | undefined>),
        },
      },
    });
  },
};

export default config;
