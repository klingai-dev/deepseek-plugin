window.__ModuleLoader__.load({
  id: "kling-ai-deepseek-harness",
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name2 in all)
        __defProp(target, name2, { get: all[name2], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    
    // src/client.jsx
    var client_exports = {};
    __export(client_exports, {
      apply: () => apply,
      inject: () => inject,
      name: () => name
    });
    module.exports = __toCommonJS(client_exports);
    var import_react = __toESM(require("react"), 1);
    
    // src/result-model.js
    var MEDIA_EXTENSIONS = /\.(?:avif|gif|jpe?g|png|webp|mp4|mov|m4v|webm)$/iu;
    var VIDEO_EXTENSIONS = /\.(?:mp4|mov|m4v|webm)$/iu;
    var URL_PATTERN = /https:\/\/[^\s<>"'`\\]+/giu;
    var KLING_HOST = /(^|\.)klingai\.com$/iu;
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
      const seen = /* @__PURE__ */ new Set();
      for (const candidate of [
        text,
        text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
        text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)
      ]) {
        if (!candidate || seen.has(candidate)) continue;
        seen.add(candidate);
        try {
          values.push(JSON.parse(candidate));
        } catch {
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
        url: value
      };
    }
    function extractKlingMedia(text) {
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
    function resultText(block) {
      if (!("kind" in block)) return "";
      return block.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
    }
    function resultState(block) {
      if (!("kind" in block)) return "running";
      if (block.isError) return "error";
      return extractKlingMedia(resultText(block)).length > 0 ? "media" : "complete";
    }
    
    // src/client.jsx
    var TOOL_PREFIX = "mcp__Plugin-DeepSeek-kling-ai__";
    var DISPLAY_TOOLS = [
      "text_to_image",
      "image_to_image",
      "text_to_video",
      "image_to_video",
      "motion_control",
      "query_result",
      "query_tasks"
    ].map((name2) => `${TOOL_PREFIX}${name2}`);
    var styles = `
    .kling-dsh-card{max-width:760px;margin:4px 0;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-primary);font:14px/1.5 Inter,system-ui,sans-serif}
    .kling-dsh-head{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-secondary)}
    .kling-dsh-mark{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:#12b981;color:#061a12;font-weight:800}
    .kling-dsh-status{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .kling-dsh-media{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
    .kling-dsh-media[data-single=true]{grid-template-columns:minmax(0,1fr)}
    .kling-dsh-media img,.kling-dsh-media video{display:block;width:100%;max-height:560px;border-radius:10px;background:#070b0a;object-fit:contain}
    .kling-dsh-link{display:inline-block;margin-top:8px;color:var(--dsw-alias-label-link,#2d7ff9);text-decoration:none}
    .kling-dsh-link:hover{text-decoration:underline}
    .kling-dsh-error{margin-top:8px;color:var(--dsw-alias-state-error-primary);white-space:pre-wrap;overflow-wrap:anywhere}
    `;
    function KlingToolCard({ block }) {
      const state = resultState(block);
      const text = resultText(block);
      const media = state === "media" ? extractKlingMedia(text) : [];
      const summary = state === "running" ? "\u6B63\u5728\u8C03\u7528\u53EF\u7075 AI\u2026" : state === "error" ? "\u53EF\u7075\u8C03\u7528\u5931\u8D25" : state === "media" ? "\u53EF\u7075\u751F\u6210\u7ED3\u679C" : "\u53EF\u7075\u4EFB\u52A1\u5DF2\u8FD4\u56DE";
      return /* @__PURE__ */ import_react.default.createElement("section", { className: "kling-dsh-card", "data-state": state }, /* @__PURE__ */ import_react.default.createElement("div", { className: "kling-dsh-head" }, /* @__PURE__ */ import_react.default.createElement("span", { className: "kling-dsh-mark", "aria-hidden": "true" }, "K"), /* @__PURE__ */ import_react.default.createElement("span", { className: "kling-dsh-status" }, summary)), media.length > 0 && /* @__PURE__ */ import_react.default.createElement("div", { className: "kling-dsh-media", "data-single": media.length === 1 }, media.map((item) => /* @__PURE__ */ import_react.default.createElement("div", { key: item.url }, item.kind === "video" ? /* @__PURE__ */ import_react.default.createElement("video", { src: item.url, controls: true, playsInline: true, preload: "metadata", referrerPolicy: "no-referrer" }) : /* @__PURE__ */ import_react.default.createElement("img", { src: item.url, alt: "\u53EF\u7075 AI \u751F\u6210\u7ED3\u679C", loading: "lazy", referrerPolicy: "no-referrer" }), /* @__PURE__ */ import_react.default.createElement("a", { className: "kling-dsh-link", href: item.url, target: "_blank", rel: "noreferrer" }, "\u6253\u5F00\u539F\u59CB\u7ED3\u679C")))), state === "error" && /* @__PURE__ */ import_react.default.createElement("div", { className: "kling-dsh-error" }, text.split("\n")[0] || "\u5DE5\u5177\u8C03\u7528\u5931\u8D25"));
    }
    var name = "kling-ai-deepseek-harness-client";
    var inject = ["slots"];
    function apply(ctx) {
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.pluginCss = "kling-ai-deepseek-harness";
        tag.textContent = styles;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, "kling-ai: result-card styles");
      ctx.slots.inject("tool.call.toolview", function* registerKlingToolCards() {
        for (const key of DISPLAY_TOOLS) {
          yield ctx.slots.register({ name: "tool.call.toolview", key }, KlingToolCard);
        }
      });
    }
    
    return module.exports;
  },
});
