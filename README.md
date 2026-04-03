# Remote Control Bridge

一个最小可运行的 `Web 控制台 + Bridge 兼容后端` 项目，用来对接现有 Claude Code `bridge` 机制。

第一版范围只覆盖：

- 环境注册
- session 创建
- `work poll / ack / heartbeat`
- `session_ingress` WebSocket + HTTP 写入口
- Web 控制台的环境列表、会话详情、消息发送、事件流展示

不包含：

- 权限批准 UI
- interrupt / model 切换等高级控制
- 多租户
- 多 environment 多活跃 session 调度

## 目录

- [src/server.ts](/Users/zhengjunyuan/githubProject/claude-code-rev/Remote/src/server.ts)：后端入口
- [src/shared/protocol.ts](/Users/zhengjunyuan/githubProject/claude-code-rev/Remote/src/shared/protocol.ts)：协议与数据结构
- [src/lib/store.ts](/Users/zhengjunyuan/githubProject/claude-code-rev/Remote/src/lib/store.ts)：本地 JSON 存储
- [public/index.html](/Users/zhengjunyuan/githubProject/claude-code-rev/Remote/public/index.html)：控制台页面
- [public/app.js](/Users/zhengjunyuan/githubProject/claude-code-rev/Remote/public/app.js)：前端逻辑

## 本地启动

要求：

- Bun 1.3+

在项目目录执行：

```bash
cd /Users/zhengjunyuan/githubProject/claude-code-rev/Remote
bun run dev
```

启动后终端会打印类似：

```text
Remote Control backend listening on localhost:55221
Database: /Users/zhengjunyuan/githubProject/claude-code-rev/Remote/data/remote-control-db.json
```

然后在浏览器打开：

```text
http://localhost:55221
```

## 常用命令

```bash
bun run dev
bun run start
bun run check
```

## 环境变量

可选环境变量：

- `PORT`：固定监听端口；不传则由 Bun 分配可用端口
- `REMOTE_CONTROL_API_BASE_URL`：生成 `work secret.api_base_url` 时使用的外部访问地址
- `REMOTE_CONTROL_DB_PATH`：JSON 数据文件路径
- `REMOTE_CONTROL_ADMIN_TOKEN`：设置后，管理接口可使用该 Bearer Token
- `REMOTE_CONTROL_WORK_LEASE_MS`：work lease 时长，默认 5 分钟
- `REMOTE_CONTROL_ENABLE_HEALTHCHECK=1`：开启额外健康检查提示日志
- `REMOTE_CONTROL_DEBUG=1`：开启后端 debug 日志

固定端口启动示例：

```bash
PORT=8787 bun run dev
```

开启 debug 模式示例：

```bash
PORT=8787 REMOTE_CONTROL_DEBUG=1 bun run dev
```

debug 模式会输出这些信息：

- HTTP 请求与响应状态码
- environment/session/work 的关键状态变更
- session event 追加与广播
- `session_ingress` WebSocket 的 upgrade、open、close、replay

日志里的 token、secret、Authorization 会做脱敏处理。

然后访问：

```text
http://localhost:8787
```

## 已实现接口

后端当前暴露这些接口：

- `POST /v1/environments/bridge`
- `GET /v1/environments`
- `GET /v1/environments/:environmentId`
- `GET /v1/environments/:environmentId/work/poll`
- `POST /v1/environments/:environmentId/work/:workId/ack`
- `POST /v1/environments/:environmentId/work/:workId/heartbeat`
- `POST /v1/environments/:environmentId/work/:workId/stop`
- `POST /v1/environments/:environmentId/bridge/reconnect`
- `POST /v1/sessions`
- `GET /v1/sessions`
- `GET /v1/sessions/:sessionId`
- `POST /v1/sessions/:sessionId/events`
- `GET /sessions/:sessionId/events`
- `GET /sessions/:sessionId/events/stream`
- `GET /v2/session_ingress/ws/:sessionId`
- `POST /v2/session_ingress/session/:sessionId/events`

## 数据存储

当前使用本地 JSON 文件持久化：

- [data/remote-control-db.json](/Users/zhengjunyuan/githubProject/claude-code-rev/Remote/data/remote-control-db.json)

适合本地开发和单用户验证，不适合生产。

## 如何让 CLI 对接

思路是让 CLI 的 bridge 配置指向这个服务。

服务端会在 `work poll` 返回的 `secret` 中提供：

- `version: 1`
- `session_ingress_token`
- `api_base_url`
- `auth`

CLI 侧拿到这些值后，会继续走现有 bridge 链路，不需要改当前仓库主执行链。

## 如何与 claude-code-rev 联调

已验证可以和上级目录的 `claude-code-rev` 连通。

### 1. 启动 Remote

```bash
cd /Users/zhengjunyuan/githubProject/claude-code-rev/Remote
PORT=8787 bun run dev
```

### 2. 启动 claude-code-rev 的 bridge 进程

```bash
cd /Users/zhengjunyuan/githubProject/claude-code-rev

CLAUDE_CODE_FORCE_BRIDGE_MODE=1 \
CLAUDE_BRIDGE_BASE_URL=http://127.0.0.1:8787 \
CLAUDE_BRIDGE_OAUTH_TOKEN=dummy-token \
CLAUDE_BRIDGE_SESSION_INGRESS_URL=http://127.0.0.1:8787 \
bun ./src/bootstrap-entry.ts remote-control --no-create-session-in-dir
```

说明：

- `CLAUDE_CODE_FORCE_BRIDGE_MODE=1`：当前恢复树的 dev build 默认未打开 `BRIDGE_MODE`
- `CLAUDE_BRIDGE_BASE_URL`：bridge API 指向本地 `Remote`
- `CLAUDE_BRIDGE_OAUTH_TOKEN`：本地兼容测试用占位 token
- `CLAUDE_BRIDGE_SESSION_INGRESS_URL`：session ingress 也指向本地服务

### 3. 打开 Web 控制台并创建 session

打开：

```text
http://127.0.0.1:8787
```

然后：

- 看见 environment 上线
- 在环境卡片中创建 session
- bridge 进程会 poll 到 work 并进入 `Connected`

### 已验证结果

本地实测已通过：

- environment 注册
- bridge 进入 `Ready`
- Web 创建 session
- bridge 进入 `Attached`
- bridge 进入 `Connected`

## 当前限制

- 只支持单租户
- 默认一个 environment 同时只有一个活跃 session
- event 去重基于 `uuid`
- `control_request / control_response` 目前不做完整控制面处理
- 真实生产接入前，建议把 JSON 存储替换成数据库，并补鉴权与审计
