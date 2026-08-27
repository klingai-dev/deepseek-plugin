import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractKlingMedia } from "../src/result-model.js";

const root = resolve(import.meta.dirname, "..");
const MCP_REMOTE_VERSION = "0.2.0";
const files = ["index.js", "cordis.patch.yml", "skills/kling-ai/SKILL.md", "package.json"];
for (const file of files) {
  const text = await readFile(resolve(root, file), "utf8");
  if (/mcp-app|kling[-_]mcp-app/u.test(text)) {
    throw new Error(`${file} must not depend on the local MCP App`);
  }
}
const patch = await readFile(resolve(root, "cordis.patch.yml"), "utf8");
if (!patch.includes("https://klingai.com/mcp")) {
  throw new Error("Domestic Kling MCP patch is invalid");
}
if (!patch.includes("- insert:")) {
  throw new Error("Domestic Kling MCP patch must insert the skill and MCP client");
}
if (!patch.includes("id: kling-ai-skill") || !patch.includes("name: kling-ai-deepseek-harness")) {
  throw new Error("Domestic bundle must mount the packaged Kling AI skill provider");
}
for (const phrase of [
  `mcp-remote@${MCP_REMOTE_VERSION}`,
  "--static-oauth-client-metadata",
  "Plugin-DeepSeek",
  "--header",
  "X-Kling-Integration:Plugin-DeepSeek",
  "--auth-timeout",
  "'180'",
]) {
  if (!patch.includes(phrase)) throw new Error(`Domestic patch is missing: ${phrase}`);
}
if (patch.includes("mcp-remote@latest")) {
  throw new Error("Domestic patch must pin mcp-remote");
}
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
assert.equal(packageJson.version, "1.0.0", "DeepSeek release version must be 1.0.0");
assert.equal(packageJson.dsh?.bundle?.patch, "./cordis.patch.yml", "DeepSeek release must declare dsh.bundle.patch");
assert.equal(packageJson.repository?.url, "https://github.com/klingai-dev/deepseek-plugin.git");
assert.ok(!packageJson.files?.some((path) => path.includes("install-kling-ai-plugin")), "release archive must not ship the retired installer skill");
assert.equal(packageJson.exports?.["./client"], "./lib/client.js", "DeepSeek result card must export its client bundle");
assert.equal(packageJson.dsh?.client?.platform, "web", "DeepSeek result card must target the web client");
assert.ok(packageJson.dsh?.client?.inject?.includes("@deepseek-ai/dsh-client-ui-tool"), "DeepSeek result card must load after the official tool UI");
assert.ok(packageJson.files?.includes("lib/client.js"), "DeepSeek release must ship the result-card bundle");
assert.ok(!packageJson.files?.some((path) => path.startsWith("src")), "DeepSeek release must not ship source-only client files");
for (const retiredPath of ["mcp-app", "skills/install-kling-ai-plugin"]) {
  try {
    await access(resolve(root, retiredPath));
    throw new Error(`DeepSeek retired local Widget runtime still exists: ${retiredPath}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const client = await readFile(resolve(root, "lib/client.js"), "utf8");
for (const phrase of [
  'id: "kling-ai-deepseek-harness"',
  "tool.call.toolview",
  "mcp__Plugin-DeepSeek-kling-ai__",
  '"query_tasks"',
  '"query_result"',
]) {
  assert.ok(client.includes(phrase), `DeepSeek result-card bundle is missing: ${phrase}`);
}
assert.ok(!client.includes("AppBridge"), "DeepSeek native result card must not pretend to be an MCP Apps host");

const signedImage = "https://p4-fdl.klingai.com/path/result.png?x-kling-signature=a%2Bb%3D&expires=123";
const signedVideo = "https://p4-fdl.klingai.com/path/result.mp4?token=a.b-c_d&expires=456";
assert.deepEqual(extractKlingMedia(JSON.stringify({ works: [{ url: signedImage }] })), [
  { kind: "image", url: signedImage },
]);
assert.deepEqual(extractKlingMedia(`结果：${signedImage}\n视频：${signedVideo}`), [
  { kind: "video", url: signedVideo },
]);
assert.deepEqual(extractKlingMedia("https://example.com/untrusted.png?token=secret"), []);
const readme = await readFile(resolve(root, "README.md"), "utf8");
if (readme.includes("Kling Widget**") || readme.includes("mcp__kling-ai__")) {
  throw new Error("DeepSeek README advertises an unshipped Widget or stale tool namespace");
}
if (!readme.includes('dsh plugin --profile web add "$PWD"')) {
  throw new Error("DeepSeek README must install the current package directory after changing into it");
}
if (!readme.includes("dsh plugin --profile web add github:klingai-dev/deepseek-plugin#v1.0.0")) {
  throw new Error("DeepSeek README must provide the immutable v1.0.0 GitHub install command");
}

const skill = await readFile(resolve(root, "skills/kling-ai/SKILL.md"), "utf8");
for (const phrase of [
  "签名查询参数",
  "逐字保留完整 URL",
  "Markdown 目标必须与当次工具结果中的 URL 完全一致",
  "任务已完成，但当前未取得可访问链接",
]) {
  assert.ok(skill.includes(phrase), `DeepSeek result-link contract is missing: ${phrase}`);
}

const { apply } = await import("../index.js");
let registeredSkill;
const dispose = apply({
  skills: {
    register(skill) {
      registeredSkill = skill;
      return () => {};
    },
  },
});
assert.equal(typeof dispose, "function");
assert.equal(registeredSkill?.name, "kling-ai");
assert.equal(registeredSkill?.source, "bundled");
assert.ok(registeredSkill?.content.startsWith("# Kling AI for DeepSeek Harness"));
assert.ok(!registeredSkill?.content.startsWith("---"), "runtime skill content must not retain frontmatter");
console.log("DeepSeek Kling domestic remote MCP package is valid.");
