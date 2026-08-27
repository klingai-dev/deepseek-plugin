---
name: kling-ai
description: 当用户希望通过 DeepSeek Harness 中的 Kling AI 插件生成电影级画质的图像与视频时使用。支持文生图、图生图、文生视频、图生视频、动作控制、任务状态与灵感值查询；计费提交前必须让用户确认。
---

# Kling AI for DeepSeek Harness

一句话，让灵感从想法变成大片。将用户的自然语言需求转化为规格明确的可灵图片或
视频任务，适合海报、广告、产品展示、营销短片、社交媒体内容和电影感创作。

## 请求路由

- 文生图、图生图、海报、封面、产品静物和图像概念使用实时图片生成工具。
- 文生视频、图生视频、动作控制、动画、镜头运动和分镜使用实时视频生成工具。
- OAuth、账号与灵感值、素材上传、动作库、Element 素材和任务状态使用对应只读或管理工具。
- 对已有结果的后续请求优先查询原任务，不要重新创建生成任务。
- 附件本身不能决定用途；不明确时先确认它是首帧、主体或产品参考、待编辑源图，还是风格参考。

## 工具边界

- 只使用国内服务 `https://klingai.com/mcp`。工具使用 `mcp__Plugin-DeepSeek-kling-ai__` 前缀，包括账号/额度、素材上传、图片和视频生成、动作控制、任务查询、主体 CRUD 与动作库查询；以实时工具目录和 schema 为准。
- `text_to_image`、`image_to_image`、`text_to_video`、`image_to_video` 是消耗额度的写操作。
- 不得要求用户在聊天中粘贴 API Key、Token、Cookie 或授权头。授权由本机 `mcp-remote` 的标准 OAuth 浏览器流程完成。
- 不要在思考、日志或错误消息里展开签名输出 URL；最终回复中的一个兼容结果链接可以承载 URL。

## 生成流程

1. 本轮第一次使用可灵时，先调用 `mcp__Plugin-DeepSeek-kling-ai__who_am_i` 验证账号，并以实时工具 schema 为参数事实源。
2. 若用户使用参考素材，可先调用 `file_upload`；上传不等于授权生成。
3. 在任何计费生成调用前，向用户列出模型、提示词、时长或分辨率、宽高比和数量，并明确说明会消耗额度，等待用户确认。
4. 每个已确认意图只调用一次对应生成工具。超时或返回不确定时不要自动重提，先按 `taskTraceId` 或 `generationId` 查询。
5. 提交成功后保存 `generationId`，约每 10 秒调用一次 `query_tasks`，最长间隔不得超过 15 秒。任务处于 `QUEUING`、`QUEUED`、`PROCESSING`、`RUNNING`、`GENERATING` 时不要结束当前轮次。
6. `COMPLETED`、`SUCCEEDED`、`SUCCESS`、`FAILED`、`ERROR`、`CANCELED`、`CANCELLED`、`TIMEOUT` 为终态。到达终态后简洁报告参数和 `generationId`。当前 Harness MCP bridge 不消费 App resources；插件的宿主原生工具卡会从同一次工具结果中呈现可识别媒体。不要手写 Markdown 图片/视频语法或添加额外媒体附件、缩略图、重复下载链接，只使用同一次调用的文本/resource 回落和最多一个主结果链接。
7. 直接状态查询只调用一次 `query_tasks`，不要擅自循环。

## 结果链接完整性

- `query_tasks` 返回的 CDN URL 可能包含 `?` 后的签名查询参数；这些参数是访问链接的一部分，缺失后会返回 `403`。必须从工具结果逐字保留完整 URL，包括 scheme、host、path、`?` 和全部查询参数。
- 不得删除、脱敏、截断、缩短、解码、重新编码或自行重建结果 URL，也不得只复制 `.png`、`.jpg` 或 `.mp4` 结尾的裸路径。
- 最终回复使用一个简短标签承载完整目标，例如 `[打开生成结果（链接可能临时有效）](完整原始URL)`；不要把数百字符的签名 URL 直接铺在正文中。Markdown 目标必须与当次工具结果中的 URL 完全一致。
- 如果无法确认目标 URL 被完整保留，或工具只返回了不带签名参数的裸路径，不要向用户宣称链接可用。对同一个 `generationId` 只调用一次 `query_tasks` 刷新结果；仍不完整时报告“任务已完成，但当前未取得可访问链接”，保留任务编号，绝不重新生成。

## 质量优先的默认策略

仅在用户没有指定其他选择且实时工具 schema 支持时使用：

- 在满足生成模式、参考素材和参数要求的模型中优先完整质量模型；只有用户明确要求草稿、快速或省灵感值时才选择极速、Turbo 或低成本模型。
- 图片普通交付优先 `2k`；高质量、商用、广告或需要后期裁切时优先 `4k`；只有草稿或速度优先时使用 `1k`。
- 视频普通交付优先 `1080p`；高质量、商用或后期需求在支持时优先 `4k`；只有草稿、快速或成本优先时使用 `720p`。
- 一个动作或单镜头优先 `5` 秒；对白、演唱、完整产品动作或两个相连节拍优先 `10` 秒。选择足以完整表达内容的最短时长。
- 根据投放位置选择画幅：竖版短视频用 `9:16`，方形信息流用 `1:1`，横版广告、网页或 YouTube 用 `16:9`；没有投放上下文时才默认 `16:9`。
- 用户没有要求多个结果时只生成一个；除非明确要求画面文字，否则优先生成无文字的干净视觉。
- 把“电影感、高级、高质量”等抽象要求落实为可见的镜头运动、光线、材质、景深、色彩、动作节奏和构图，不要只堆砌形容词。

## OAuth client identity

The packaged `mcp-remote@0.2.0` arguments inject
`client_name: "Plugin-DeepSeek"` as static OAuth client metadata before dynamic
registration and allow 180 seconds for the local callback. This is OAuth
metadata, not a tool argument, URL query parameter, generation field, or secret.
Preserve the packaged arguments exactly; do not invent a second OAuth flow.

## 授权失败

如果 `who_am_i` 或工具发现提示未授权，让用户保持 `dsh web` 进程运行并完成浏览器中自动打开的 Kling OAuth 页面，然后新建会话重试。若 access token 与 refresh token 同时失效，停止并重新启动 DSH，让固定版本的 bridge 重新建立 callback listener；不要在仍运行的进程里反复点击授权，不要上传原始 debug log，也不要改用 API Key。

## 示例

- 画一只身穿复古宇航服的小熊猫，漂浮在空间站舷窗前，地球蓝光映亮面部，细节丰富，电影级质感
- 制作一段 5 秒电影感视频：机甲战士从高空重砸地面，冲击波瞬间震开碎石与尘雾，镜头快速推近，充满力量感
- 制作一条 15 秒运动鞋营销短片：街头开场抓住注意力，三秒切出产品特写与穿着动态，结尾落在鞋身细节特写
