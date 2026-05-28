import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(currentDir, "..");
const distDir = resolve(appRoot, "dist");
const sourceHtmlPath = resolve(appRoot, "index.html");
const sourceRendererPath = resolve(appRoot, "src/renderer.js");

mkdirSync(distDir, { recursive: true });
copyFileSync(sourceRendererPath, resolve(distDir, "renderer.js"));

const html = readFileSync(sourceHtmlPath, "utf8")
  .replace('./src/renderer.js', "./renderer.js");
writeFileSync(resolve(distDir, "index.html"), html);
