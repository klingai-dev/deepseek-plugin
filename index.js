import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const name = "kling-ai-deepseek-harness";
export const inject = ["skills"];

export function apply(ctx) {
  const skillPath = fileURLToPath(new URL("./skills/kling-ai/SKILL.md", import.meta.url));
  const skillSource = readFileSync(skillPath, "utf8");
  const skillContent = skillSource.replace(/^---\n[\s\S]*?\n---\n/, "").trimStart();
  return ctx.skills.register({
    name: "kling-ai",
    description: "用可灵MCP打造独属于你的 AI 创作工作流。提交消耗积分的生成任务前必须等待用户确认。",
    source: "bundled",
    content: skillContent,
    path: skillPath,
  });
}
