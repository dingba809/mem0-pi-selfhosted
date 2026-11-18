# mem0-pi-selfhosted

面向 **自托管 Mem0 服务器**（[mem0ai/mem0 `server/`](https://github.com/mem0ai/mem0/tree/main/server)）的 [Pi Agent](https://pi.dev) 扩展与技能包。

基于官方 `@mem0/pi-agent-plugin` 改造，将云端 `MemoryClient`（`api.mem0.ai`）替换为原生 `fetch` + `X-API-Key` 适配器，可直接连接内网或本地部署的 Mem0 FastAPI 服务，且零第三方 npm 运行依赖。

## 与官方插件的差异

| 项目 | 官方 `@mem0/pi-agent-plugin` | 本仓库 `mem0-pi-selfhosted` |
| :--- | :--- | :--- |
| 服务端 | Mem0 Cloud (`https://api.mem0.ai`) | 任意自托管 Mem0 Server (`baseUrl`) |
| 鉴权头 | `Authorization: Token <key>` | `X-API-Key: <key>` |
| 作用域映射 | `app_id` | 自动映射为自托管支持的 `agent_id` |
| 遥测 | 上报 PostHog | 本地空实现（不外发数据） |
| 外部依赖 | `mem0ai` | 无（使用 Node.js 内置 `fetch`） |

---

## 一、安装到 Pi

### 方式 1：直接通过 GitHub URL 安装（推荐）

```bash
pi install https://github.com/dingba809/mem0-pi-selfhosted
```

### 方式 2：克隆到本地目录后安装

```bash
git clone https://github.com/dingba809/mem0-pi-selfhosted.git
pi install ./mem0-pi-selfhosted
```

安装完成后，在 Pi 会话中执行 `/reload` 或重启 Pi。

---

## 二、客户端配置

在 `~/.pi/agent/mem0-config.json`（Windows 为 `C:\Users\<用户名>\.pi\agent\mem0-config.json`）创建配置文件（可参考 [`mem0-config.example.json`](mem0-config.example.json)）：

```json
{
  "baseUrl": "http://<your-server-ip>:8888",
  "apiKey": "m0sk_your_api_key_here",
  "userId": "your-username",
  "autoCapture": true,
  "defaultScope": "project",
  "contextInjection": true,
  "searchThreshold": 0.3
}
```

### 配置项说明

| 字段 | 环境变量覆盖 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `baseUrl` | `MEM0_BASE_URL` | `http://localhost:8888` | 自托管 Mem0 API 服务地址（末尾不要带 `/`） |
| `apiKey` | `MEM0_API_KEY` | `""` | 在自托管 Dashboard 生成的 `X-API-Key`（或 `ADMIN_API_KEY`） |
| `userId` | `MEM0_USER_ID` | 当前系统用户名 | 记忆归属的用户标识 |
| `autoCapture` | — | `true` | 每轮对话结束自动提取并存入 `project` 记忆 |
| `contextInjection` | — | `true` | 对话开始前自动检索相关 `project` 记忆注入上下文 |
| `defaultScope` | — | `"project"` | 默认作用域：`project` / `session` / `global` |
| `searchThreshold` | — | `0.3` | 语义检索相关性阈值（0–1） |

> 提示：如果 Pi 中同时安装了其它自动记忆扩展（如 `hindsight-coding-agent`），可将 `autoCapture` 或 `contextInjection` 设为 `false`，仅保留手动命令与 `mem0_memory` 工具调用，避免重复注入上下文。

---

## 三、提供的工具、命令与 Skills

- **Agent 工具**：`mem0_memory`（支持 `search`、`add`、`get_all`、`update`、`delete`、`delete_all`）
- **斜杠命令**：
  - `/mem0-status` — 查看服务端地址、连接状态、当前作用域与记忆数
  - `/mem0-remember <text>` — 原文直接存入记忆（不经过 LLM 抽取）
  - `/mem0-search <query>` — 语义搜索记忆
  - `/mem0-tour [scope]` — 按分类浏览当前作用域全部记忆
  - `/mem0-forget <query>` — 搜索并交互确认删除匹配记忆
  - `/mem0-scope [project|session|global]` — 切换当前会话默认作用域
- **内置 Skills**（`skills/`）：`context-loader`、`remember`、`search`、`forget`、`tour`、`status`

---

## 四、自托管服务端常见坑点（Docker Compose 部署参考）

基于 `mem0ai/mem0/tree/main/server` 通过 Docker Compose 部署在局域网主机（如 `http://<HOST_IP>:8888` / `:3000`）时：

1. **局域网 HTTP 访问 Dashboard 无法登录（刷新跳回 `/login`）**：
   `mem0-dashboard` 在 `NODE_ENV=production` 下若未传入 `DASHBOARD_URL`，会默认给刷新令牌 Cookie 加 `Secure` 标志，导致浏览器在非 HTTPS 局域网地址丢弃 Cookie。请在 `docker-compose.override.yaml` 为两个服务同时设置外部访问地址：
   ```yaml
   services:
     mem0:
       restart: unless-stopped
       environment:
         - DASHBOARD_URL=http://<HOST_IP>:3000
     postgres:
       restart: unless-stopped
     mem0-dashboard:
       restart: unless-stopped
       environment:
         - NEXT_PUBLIC_API_URL=http://<HOST_IP>:8888
         - DASHBOARD_URL=http://<HOST_IP>:3000
   ```
2. **使用自定义 OpenAI 兼容模型接口**：
   在 `server/.env` 中配置 `OPENAI_API_KEY`、`OPENAI_BASE_URL=http://<llm-host>:<port>/v1`、`MEM0_DEFAULT_LLM_MODEL`、`MEM0_DEFAULT_EMBEDDER_MODEL`（注意删掉 `.env` 底部 `.env.example` 原有的重复默认行以免被覆盖）。
3. **执行目录**：Compose 命令需在 `mem0/server/` 目录内执行（`docker compose up -d --build`）。

---

## 许可

基于 [mem0ai/mem0](https://github.com/mem0ai/mem0) 的 `integrations/pi-agent-plugin` 与 `integrations/agent-plugin-core` 改造，遵循 [Apache-2.0 License](LICENSE)。
