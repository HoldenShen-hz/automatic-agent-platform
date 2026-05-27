import { readFileSync } from "node:fs";

const target = JSON.parse(
  readFileSync(new URL("./test-target.json", import.meta.url), "utf8"),
);

const baseUrl = process.env.AA_UI_BASE_URL ?? target.baseUrl;
const host = process.env.AA_UI_HOST ?? target.host;
const port = Number.parseInt(process.env.AA_UI_PORT ?? String(target.port), 10);
const routes = Array.isArray(target.routes) ? target.routes : ["/"];

export default {
  ci: {
    collect: {
      url: routes.map((route) => new URL(route, baseUrl).toString()),
      startServerCommand:
        `npm --workspace @aa/web run build && npm --workspace @aa/web run preview -- --host ${host} --port ${port} --strictPort`,
      startServerReadyPattern: `${host}:${port}`,
      startServerReadyTimeout: 120000,
      settings: {
        preset: "desktop",
        throttlingMethod: "simulate",
        formFactor: "desktop",
        screenEmulation: {
          mobile: false,
          width: 1440,
          height: 900,
          deviceScaleFactor: 1,
          disabled: false
        }
      }
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.8 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 2000 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 4000 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "interaction-to-next-paint": ["error", { maxNumericValue: 200 }],
        "total-blocking-time": ["warn", { maxNumericValue: 500 }],
        "speed-index": ["warn", { maxNumericValue: 4000 }],
        "server-response-time": ["warn", { maxNumericValue: 800 }],
        "uses-responsive-images": "warn",
        "uses-optimized-images": "warn",
        "uses-text-compression": "warn",
        "uses-long-cache-ttl": "warn",
        "render-blocking-resources": "warn"
      }
    },
    upload: {
      target: "temporary-public-storage"
    }
  }
};
