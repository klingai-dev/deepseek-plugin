#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const dshHome = await mkdtemp(resolve(tmpdir(), "kling-dsh-runtime-"));

const runDsh = (args) => spawnSync("dsh", args, {
  encoding: "utf8",
  env: { ...process.env, DSH_HOME: dshHome },
});

const requireSuccess = (result, step) => {
  if (result.error?.code === "ENOENT") {
    throw new Error("DeepSeek Harness CLI (dsh) is not installed");
  }
  if (result.status !== 0) {
    throw new Error(`${step} failed in the isolated profile: ${result.stderr}`);
  }
  return result.stdout;
};

try {
  requireSuccess(
    runDsh(["plugin", "--profile", "web", "add", packageRoot]),
    "plugin installation",
  );

  const output = requireSuccess(
    runDsh(["--profile", "web", "--dump-config"]),
    "domestic config composition",
  );
  const rowCount = output.split("serverName: Plugin-DeepSeek-kling-ai").length - 1;
  assert.equal(rowCount, 1, "Domestic package must compose exactly one Kling MCP row");
  const skillRowCount = output.split("name: kling-ai-deepseek-harness").length - 1;
  assert.equal(skillRowCount, 1, "Domestic package must compose exactly one Kling skill provider row");
  assert.ok(output.includes("https://klingai.com/mcp"), "Domestic endpoint is missing");
  for (const expected of ["mcp-remote@0.2.0", "--auth-timeout", "180"]) {
    assert.ok(output.includes(expected), `Domestic config is missing ${expected}`);
  }

  console.log("DeepSeek Harness isolated install verified: the domestic package composes one Kling skill provider and one pinned MCP bridge.");
} finally {
  await rm(dshHome, { recursive: true, force: true });
}
