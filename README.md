# 可灵 AI for DeepSeek Harness

一句话，让灵感从想法变成大片。在 DeepSeek Harness 中直接用自然语言调用
可灵 AI，支持文生图、图生图、文生视频、图生视频、参考图创作、任务跟踪和
结果预览。

## 功能

- 文生图、图生图，制作海报、插画、人像、产品图、电商主图和广告素材
- 文生视频、图生视频与动作控制，制作产品展示、营销短片、社交媒体视频和电影感内容
- 上传参考素材，查询灵感值、生成进度和历史任务
- 通过浏览器完成可灵账号 OAuth，不需要在对话中粘贴 API Key
- 生成前展示最终参数并等待确认，每个确认过的意图只提交一次
- 在 DeepSeek Harness 工具卡中直接预览已完成的可灵图片或视频，并保留原始结果链接

## 安装

直接安装固定的 `v1.0.0` 版本：

```bash
dsh plugin --profile web add github:klingai-dev/deepseek-plugin#v1.0.0
dsh web --host 127.0.0.1 --port 3080
```

首次启动时，保持 `dsh web` 进程运行，在自动打开的浏览器页面完成可灵账号授权，
然后新建一个 Harness 会话。

## 使用

输入 `/kling-ai`，再用自然语言描述你想要的图片或视频。插件会补齐真正影响结果的
必要信息，在计费生成前展示模型、提示词、画幅、时长或分辨率与数量，并等待确认。
提交后只跟踪同一个任务，不会因超时或结果不明确而重复生成。

例如：

- `生成一张电影感图片：一只穿复古宇航服的小熊猫漂浮在空间站舷窗前，16:9`
- `制作一段 5 秒电影感视频：机甲战士从高空重砸地面，镜头快速推近，16:9`
- `检查当前授权和灵感值，不要创建生成任务`

灵感值不足时，请充值后再试。完成后会返回任务编号和可灵提供的主要结果链接；
临时链接失效后，可以使用原任务编号重新查询。

结果链接可能包含用于访问 CDN 的签名查询参数。插件必须逐字保留完整链接，并用
简短的“打开生成结果”标签承载，不得删除 `?` 后的参数、只保留文件路径或把长链接
直接铺在正文中。若无法取得完整链接，插件会保留任务编号并提示重新查询，而不会
重复生成。

## 本地开发与验证

DeepSeek Harness 插件通过 Harness 官方 MCP tools bridge 和固定版本
`mcp-remote` 的标准 OAuth 流程连接国内服务。安装包只注册
`cordis.patch.yml` 中的 `https://klingai.com/mcp`，并且只创建一个
`Plugin-DeepSeek-kling-ai` MCP 客户端。

```bash
git clone https://github.com/klingai-dev/deepseek-plugin.git
cd deepseek-plugin
npm install
npm run build
npm run check
npm run verify:bridge
npm run verify:installed
dsh plugin --profile web add "$PWD"
dsh web --host 127.0.0.1 --port 3080
```

`verify:bridge` 只使用本地假 OAuth/MCP；`verify:installed` 只在临时
`DSH_HOME` 内安装和合成配置，不读取或改写现有 Harness profile。

运行 `dsh --profile web --dump-config` 可在授权前检查有效配置；输出中应只出现
一个 `Plugin-DeepSeek-kling-ai` 客户端和国内 MCP 地址。

首次启动时 `mcp-remote` 会打开浏览器完成 Kling OAuth。配置通过
`--static-oauth-client-metadata` 固定 DCR `client_name` 为
`Plugin-DeepSeek`，携带 `X-Kling-Integration: Plugin-DeepSeek`，并把 callback
等待时间从上游默认 30 秒延长到 180 秒。保持
`dsh web` 进程运行，完成授权后新建 Harness 会话，输入 `/kling-ai`
加载计费安全流程。真实工具名使用
`mcp__Plugin-DeepSeek-kling-ai__*` 前缀。

Harness 官方 MCP 客户端 0.1.0-rc.6 目前只桥接 tools，不消费 MCP resources，
也没有标准 MCP Apps 容器。本包因此不复制远端 App、不注册第二个 MCP server，
而是使用 Harness 官方 `tool.call.toolview` 扩展点提供一个宿主原生结果卡：它只从
同一次可灵工具调用保留下来的文本结果中读取完整 `https://*.klingai.com` 媒体 URL，
内嵌预览图片或视频，并保留原始链接。它不是 MCP App，也不会调用工具、自动刷新或
提交生成；真实生成仍由远端 MCP 完成并受 Skill 的确认与单次提交约束。

## 跨平台呈现契约

- 不复制或链接仓库根目录的本地 `mcp-app/`，不把 Harness 原生结果卡称为 MCP App。
- 结果卡只承担呈现，不调用工具、不拥有轮询、不改变计费与任务状态；无法识别媒体时
  保持普通工具结果回落。
- Harness 官方 MCP 客户端增加 resources consumer 后，直接消费远端
  `_meta.ui.resourceUri`，届时删除此宿主适配，避免与标准 MCP App 重复呈现。

## OAuth bridge 边界

本包固定 `mcp-remote@0.2.0`，不使用会随时间漂移的 `@latest`。仓库的
`npm run verify:bridge` 会用本地假 OAuth/MCP 服务验证 protected-resource
discovery、动态注册、`Plugin-DeepSeek` 客户端名、S256 PKCE、token endpoint、
Bearer 重试和 `tools/list`；测试不会打开真实浏览器、读取凭据或调用 Kling。

上游仍有运行中 access/refresh token 同时失效后 callback listener 未重建的
[问题 #248](https://github.com/geelen/mcp-remote/issues/248)，以及异常退出后旧
callback 端口冲突的[问题 #253](https://github.com/geelen/mcp-remote/issues/253)。
遇到授权过期时先停止并重新启动 `dsh web`，只完成新进程打开的一次授权。
不要反复点击多个旧授权页，也不要直接分享 `~/.mcp-auth` 或 `--debug` 产生的
原始日志；其中可能包含 OAuth 状态和敏感诊断信息。
