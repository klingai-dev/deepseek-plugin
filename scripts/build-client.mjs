import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const result = await build({
  entryPoints: [resolve(root, "src/client.jsx")],
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: "es2022",
  write: false,
  external: ["react"],
});

const body = result.outputFiles[0].text;
const indented = body.split("\n").map((line) => `    ${line}`).join("\n");
const wrapped = `window.__ModuleLoader__.load({\n  id: "kling-ai-deepseek-harness",\n  factory: (require) => {\n    const module = { exports: {} };\n    const exports = module.exports;\n${indented}\n    return module.exports;\n  },\n});\n`;

await mkdir(resolve(root, "lib"), { recursive: true });
await writeFile(resolve(root, "lib/client.js"), wrapped);
