# DeepSeek Harness release checklist

- Validate the package and rebuild its checked-in native result card:
  `npm install && npm test`.
- Run `npm run verify:bridge`; it must pass protected-resource discovery, DCR
  identity, S256 PKCE, token exchange, Bearer retry, initialization and
  `tools/list` against the local fake service without opening a real browser or
  reading credentials.
- With DSH installed, run `npm run verify:installed`; its isolated temporary
  profile must compose exactly one Kling skill provider and one domestic MCP
  row without reading or modifying the user's profile.
- Confirm the package and install archive contain no `mcp-app`, local HTML,
  overlay, or second MCP server. The only client artifact is `lib/client.js`,
  built from `src/client.jsx` and scoped to Kling tool names.
- Install with `dsh plugin --profile web add github:klingai-dev/deepseek-plugin#v1.0.0`,
  then repeat from a local checkout with `dsh plugin --profile web add "$PWD"`.
- Install the package into an isolated profile and validate ordinary startup.
  The composed tree must contain exactly one `kling-ai-remote` row using
  `https://klingai.com/mcp`.
- Start `dsh web` and confirm no floating **Kling Widget** overlay is advertised.
  A completed `query_tasks` result should instead render inline in its ordinary
  Harness tool-card position.
- Complete the browser OAuth flow and verify
  `mcp__Plugin-DeepSeek-kling-ai__who_am_i` succeeds without exposing
  credentials. Inspect DCR metadata for `client_name: Plugin-DeepSeek` and the
  request header for `X-Kling-Integration: Plugin-DeepSeek`.
- Confirm the packaged patch still pins `mcp-remote@0.2.0` and retains the 180-second
  callback budget. If runtime re-authorization stalls or the callback port is
  occupied, stop and restart `dsh web`; do not retry multiple stale browser
  tabs or attach raw `~/.mcp-auth`/debug logs to a report.
- Verify the bundle mounts `kling-ai-deepseek-harness`, `/kling-ai` is
  discoverable, and the loaded skill requires confirmation before every
  billable generation tool.
- Verify a non-billable `query_tasks` response renders a trusted
  `https://*.klingai.com` image or video in the native result card and preserves
  the text/resource fallback and at most one primary assistant link. When the
  result is a signed CDN URL, confirm the Markdown destination preserves the
  exact scheme, host, path, `?`, and every query parameter from the tool result;
  a query-stripped path is a release blocker because it returns `403`.
- Record the current Harness limitation: its official MCP client bridges tools
  but has no MCP resource consumer. The native card is a display-only DSH
  adapter, not an interactive MCP App; it must not poll or submit tools.
