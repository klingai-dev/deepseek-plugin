import React from "react";
import { extractKlingMedia, resultState, resultText } from "./result-model.js";

const TOOL_PREFIX = "mcp__Plugin-DeepSeek-kling-ai__";
const DISPLAY_TOOLS = [
  "text_to_image",
  "image_to_image",
  "text_to_video",
  "image_to_video",
  "motion_control",
  "query_result",
  "query_tasks",
].map((name) => `${TOOL_PREFIX}${name}`);

const styles = `
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
  const summary = state === "running"
    ? "正在调用可灵 AI…"
    : state === "error"
      ? "可灵调用失败"
      : state === "media"
        ? "可灵生成结果"
        : "可灵任务已返回";

  return <section className="kling-dsh-card" data-state={state}>
    <div className="kling-dsh-head">
      <span className="kling-dsh-mark" aria-hidden="true">K</span>
      <span className="kling-dsh-status">{summary}</span>
    </div>
    {media.length > 0 && <div className="kling-dsh-media" data-single={media.length === 1}>
      {media.map((item) => <div key={item.url}>
        {item.kind === "video"
          ? <video src={item.url} controls playsInline preload="metadata" referrerPolicy="no-referrer" />
          : <img src={item.url} alt="可灵 AI 生成结果" loading="lazy" referrerPolicy="no-referrer" />}
        <a className="kling-dsh-link" href={item.url} target="_blank" rel="noreferrer">打开原始结果</a>
      </div>)}
    </div>}
    {state === "error" && <div className="kling-dsh-error">{text.split("\n")[0] || "工具调用失败"}</div>}
  </section>;
}

export const name = "kling-ai-deepseek-harness-client";
export const inject = ["slots"];

export function apply(ctx) {
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
