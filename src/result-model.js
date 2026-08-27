const MEDIA_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|webp|mp4|mov|m4v|webm)$/iu;
const VIDEO_EXTENSIONS = /\.(?:mp4|mov|m4v|webm)$/iu;
const URL_PATTERN = /https:\/\/[^\s<>"'`\\]+/giu;
const KLING_HOST = /(^|\.)klingai\.com$/iu;

function walk(value, visit) {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walk(item, visit);
  }
}

function parsedValues(text) {
  const values = [];
  const seen = new Set();
  for (const candidate of [
    text,
    text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
    text.slice(text.indexOf("["), text.lastIndexOf("]") + 1),
  ]) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      values.push(JSON.parse(candidate));
    } catch {
      // The MCP text fallback is allowed to be prose rather than JSON.
    }
  }
  return values;
}

function cleanRawUrl(value) {
  let candidate = value;
  while (/[),.;!?，。；！、]$/u.test(candidate)) candidate = candidate.slice(0, -1);
  return candidate;
}

function mediaCandidate(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !KLING_HOST.test(url.hostname)) return null;
  if (!MEDIA_EXTENSIONS.test(url.pathname)) return null;
  return {
    kind: VIDEO_EXTENSIONS.test(url.pathname) ? "video" : "image",
    url: value,
  };
}

export function extractKlingMedia(text) {
  const candidates = [];
  const addFromString = (value, raw = false) => {
    for (const match of value.matchAll(URL_PATTERN)) {
      const candidate = mediaCandidate(raw ? cleanRawUrl(match[0]) : match[0]);
      if (candidate && !candidates.some((item) => item.url === candidate.url)) candidates.push(candidate);
    }
  };

  for (const value of parsedValues(text)) walk(value, (item) => addFromString(item));
  addFromString(text, true);

  const videos = candidates.filter((item) => item.kind === "video");
  if (videos.length > 0) return [videos[0]];
  return candidates.slice(0, 4);
}

export function resultText(block) {
  if (!("kind" in block)) return "";
  return block.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

export function resultState(block) {
  if (!("kind" in block)) return "running";
  if (block.isError) return "error";
  return extractKlingMedia(resultText(block)).length > 0 ? "media" : "complete";
}
