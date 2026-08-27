#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const MCP_REMOTE_VERSION = "0.2.0";
const CLIENT_NAME = "Plugin-DeepSeek";
const INTEGRATION_HEADER = "Plugin-DeepSeek";
const FAKE_ACCESS_TOKEN = "FAKE_DEEPSEEK_BRIDGE_ACCESS_TOKEN";
const FAKE_REFRESH_TOKEN = "FAKE_DEEPSEEK_BRIDGE_REFRESH_TOKEN";
const AUTHORIZATION_CODE = "fake-authorization-code";
const SCOPES = "generation.create generation.read account.credit.read";

const temporaryRoot = await mkdtemp(join(tmpdir(), "kling-deepseek-oauth-test-"));
const fakeBin = join(temporaryRoot, "bin");
const configDir = join(temporaryRoot, "mcp-auth");
const openPath = join(fakeBin, "open");
let child;
let server;

const evidence = {
  protectedResourceDiscovery: false,
  authorizationServerDiscovery: false,
  dynamicRegistration: false,
  authorization: false,
  tokenExchange: false,
  bearerRetry: false,
  initialize: false,
  toolsList: false,
};
let expectedCodeChallenge;
let registeredClientId;
let serverFailure;

const json = (response, status, body, headers = {}) => {
  response.writeHead(status, {
    "content-type": "application/json",
    ...headers,
  });
  response.end(JSON.stringify(body));
};

const bodyText = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

const listen = (httpServer) => new Promise((resolvePromise, rejectPromise) => {
  httpServer.once("error", rejectPromise);
  httpServer.listen(0, "127.0.0.1", () => resolvePromise());
});

try {
  await mkdir(fakeBin, { recursive: true });
  await writeFile(openPath, `#!/usr/bin/env node
const target = process.argv.at(-1);
fetch(target, { redirect: "follow" })
  .then((response) => { if (!response.ok) process.exitCode = 1; })
  .catch(() => { process.exitCode = 1; });
`);
  await chmod(openPath, 0o755);

  let baseUrl;
  let mcpUrl;
  let authBase;
  const protectedResourcePath = "/.well-known/oauth-protected-resource/mcp";

  server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", baseUrl);

      if (requestUrl.pathname === protectedResourcePath) {
        evidence.protectedResourceDiscovery = true;
        json(response, 200, {
          resource: mcpUrl,
          authorization_servers: [authBase],
          scopes_supported: SCOPES.split(" "),
        });
        return;
      }

      if (requestUrl.pathname.includes(".well-known/oauth-authorization-server")) {
        evidence.authorizationServerDiscovery = true;
        json(response, 200, {
          issuer: authBase,
          authorization_endpoint: `${authBase}/authorize`,
          token_endpoint: `${authBase}/token`,
          registration_endpoint: `${authBase}/register`,
          response_types_supported: ["code"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          token_endpoint_auth_methods_supported: ["none"],
          code_challenge_methods_supported: ["S256"],
          scopes_supported: SCOPES.split(" "),
        });
        return;
      }

      if (requestUrl.pathname === "/auth/register" && request.method === "POST") {
        const registration = JSON.parse(await bodyText(request));
        assert.equal(registration.client_name, CLIENT_NAME);
        assert.equal(registration.token_endpoint_auth_method, "none");
        assert.ok(Array.isArray(registration.redirect_uris) && registration.redirect_uris.length === 1);
        registeredClientId = "fake-deepseek-client";
        evidence.dynamicRegistration = true;
        json(response, 201, {
          ...registration,
          client_id: registeredClientId,
        });
        return;
      }

      if (requestUrl.pathname === "/auth/authorize" && request.method === "GET") {
        assert.equal(requestUrl.searchParams.get("client_id"), registeredClientId);
        assert.equal(requestUrl.searchParams.get("code_challenge_method"), "S256");
        assert.equal(requestUrl.searchParams.get("scope"), SCOPES);
        expectedCodeChallenge = requestUrl.searchParams.get("code_challenge");
        assert.ok(expectedCodeChallenge);
        const redirectUri = new URL(requestUrl.searchParams.get("redirect_uri"));
        redirectUri.searchParams.set("code", AUTHORIZATION_CODE);
        redirectUri.searchParams.set("state", requestUrl.searchParams.get("state"));
        evidence.authorization = true;
        response.writeHead(302, { location: redirectUri.toString() });
        response.end();
        return;
      }

      if (requestUrl.pathname === "/auth/token" && request.method === "POST") {
        const tokenRequest = new URLSearchParams(await bodyText(request));
        assert.equal(tokenRequest.get("grant_type"), "authorization_code");
        assert.equal(tokenRequest.get("code"), AUTHORIZATION_CODE);
        assert.equal(tokenRequest.get("client_id"), registeredClientId);
        const codeVerifier = tokenRequest.get("code_verifier");
        assert.ok(codeVerifier);
        const actualChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
        assert.equal(actualChallenge, expectedCodeChallenge);
        evidence.tokenExchange = true;
        json(response, 200, {
          access_token: FAKE_ACCESS_TOKEN,
          refresh_token: FAKE_REFRESH_TOKEN,
          token_type: "Bearer",
          expires_in: 3600,
          scope: SCOPES,
        });
        return;
      }

      if (requestUrl.pathname === "/mcp") {
        if (request.headers.authorization !== `Bearer ${FAKE_ACCESS_TOKEN}`) {
          response.writeHead(401, {
            "content-type": "application/json",
            "www-authenticate": `Bearer resource_metadata="${baseUrl}${protectedResourcePath}", scope="${SCOPES}"`,
          });
          response.end(JSON.stringify({ error: "unauthorized" }));
          return;
        }
        assert.equal(request.headers["x-kling-integration"], INTEGRATION_HEADER);
        evidence.bearerRetry = true;
        if (request.method === "GET") {
          response.writeHead(405, { allow: "POST" });
          response.end();
          return;
        }
        const message = JSON.parse(await bodyText(request));
        if (message.method === "initialize") {
          evidence.initialize = true;
          json(response, 200, {
            jsonrpc: "2.0",
            id: message.id,
            result: {
              protocolVersion: "2025-11-25",
              capabilities: { tools: {} },
              serverInfo: { name: "fake-kling-mcp", version: "1.0.0" },
            },
          });
          return;
        }
        if (message.method === "notifications/initialized") {
          response.writeHead(202);
          response.end();
          return;
        }
        if (message.method === "tools/list") {
          evidence.toolsList = true;
          json(response, 200, {
            jsonrpc: "2.0",
            id: message.id,
            result: { tools: [] },
          });
          return;
        }
      }

      response.writeHead(404);
      response.end();
    } catch (error) {
      serverFailure = error;
      json(response, 500, { error: "fake OAuth server assertion failed" });
    }
  });

  await listen(server);
  const address = server.address();
  assert.ok(address && typeof address === "object");
  baseUrl = `http://127.0.0.1:${address.port}`;
  mcpUrl = `${baseUrl}/mcp`;
  authBase = `${baseUrl}/auth`;

  child = spawn("npx", [
    "-y",
    `mcp-remote@${MCP_REMOTE_VERSION}`,
    mcpUrl,
    "--transport",
    "http-only",
    "--allow-http",
    "--static-oauth-client-metadata",
    JSON.stringify({ client_name: CLIENT_NAME }),
    "--header",
    `X-Kling-Integration:${INTEGRATION_HEADER}`,
    "--auth-timeout",
    "30",
  ], {
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
      MCP_REMOTE_CONFIG_DIR: configDir,
      NO_PROXY: "127.0.0.1,localhost",
      no_proxy: "127.0.0.1,localhost",
    },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const messages = new Map();
  let stdoutBuffer = "";
  let stderrBuffer = "";
  let childExit;

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        if (message.id !== undefined) messages.set(String(message.id), message);
      } catch {}
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrBuffer = `${stderrBuffer}${chunk}`.slice(-12_000);
  });
  childExit = new Promise((resolvePromise) => child.once("exit", (code, signal) => {
    resolvePromise({ code, signal });
  }));

  const waitForMessage = async (id, timeoutMs = 25_000) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (messages.has(String(id))) return messages.get(String(id));
      if (serverFailure) throw serverFailure;
      if (child.exitCode !== null) {
        throw new Error(`mcp-remote exited before response ${id}: ${stderrBuffer}`);
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
    }
    throw new Error(`Timed out waiting for mcp-remote response ${id}: ${stderrBuffer}`);
  };

  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "deepseek-bridge-test", version: "1.0.0" },
    },
  })}\n`);
  const initializeResponse = await waitForMessage(1);
  assert.equal(initializeResponse.result?.serverInfo?.name, "fake-kling-mcp");

  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {},
  })}\n`);
  child.stdin.write(`${JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  })}\n`);
  const toolsResponse = await waitForMessage(2);
  assert.deepEqual(toolsResponse.result?.tools, []);
  assert.equal(serverFailure, undefined);
  assert.deepEqual(evidence, {
    protectedResourceDiscovery: true,
    authorizationServerDiscovery: true,
    dynamicRegistration: true,
    authorization: true,
    tokenExchange: true,
    bearerRetry: true,
    initialize: true,
    toolsList: true,
  });

  child.stdin.end();
  const exit = await Promise.race([
    childExit,
    new Promise((resolvePromise) => setTimeout(() => resolvePromise(undefined), 3_000)),
  ]);
  if (exit === undefined && child.exitCode === null) {
    child.kill("SIGTERM");
    await childExit;
  }

  console.log(`mcp-remote@${MCP_REMOTE_VERSION} verified with fake local OAuth/MCP only: protected-resource discovery, DCR identity, S256 PKCE, token endpoint, Bearer retry, initialize, and tools/list passed.`);
} finally {
  if (child && child.exitCode === null) child.kill("SIGTERM");
  if (server) await new Promise((resolvePromise) => server.close(() => resolvePromise()));
  await rm(temporaryRoot, { recursive: true, force: true });
}
