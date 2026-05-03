# TracePilot Dashboard

TracePilot Dashboard 是 TracePilot 多智能体 DApp 漏洞定位系统的前端工作台。它用于创建分析任务、观察 9 个 Agent 的执行状态、查看实时日志和文件日志，并将最终结果整理为结构化审计报告。

前端的定位不是单纯展示 Markdown，而是把长链 Agent 分析过程做成可观察、可复盘、可导出的工程化界面。

## 功能概览

- **任务管理**：创建、查看、取消、归档、恢复、删除分析任务。
- **实时日志流**：通过 WebSocket 接收后端推送的任务状态和 Agent 中间输出。
- **Agent Brief**：聚合展示每个 Agent 的事件数、工具调用数、结果数和最新摘要。
- **Agent Timeline**：将工具调用、结果输出、错误告警和任务状态整理成时间线。
- **文件日志查看**：读取后端 `agents/logs/{time}/{DApp}` 下的 Agent 原始日志文件。
- **结构化最终报告**：将最终报告拆成漏洞根因、攻击路径、关键交易、补丁建议、验证结果。
- **报告导出**：支持导出 Markdown 审计报告和 JSON evidence package。
- **刷新恢复**：页面刷新后可通过任务详情、数据库日志和文件日志恢复任务上下文。

## 技术栈

| 类型 | 技术 |
| --- | --- |
| 前端框架 | React 18 |
| 语言 | TypeScript |
| 构建工具 | Vite |
| UI 组件 | Ant Design 6 |
| 图标 | lucide-react |
| 路由 | React Router |
| HTTP 请求 | Axios |
| Markdown 渲染 | react-markdown, remark-gfm |
| 实时通信 | WebSocket |

## 目录结构

```text
TracePilot-dashboard/
├── src/
│   ├── components/                 # 可复用组件
│   │   ├── AgentFileLogs.tsx       # Agent 文件日志查看
│   │   ├── AgentInsights.tsx       # Agent Brief 摘要
│   │   ├── AgentNavigator.tsx      # Agent 状态导航
│   │   ├── AgentTimeline.tsx       # Agent 时间线
│   │   ├── LogDetailDrawer.tsx     # 日志详情抽屉
│   │   ├── LogStream.tsx           # 实时日志流
│   │   ├── MarkdownRenderer.tsx    # Markdown 渲染
│   │   └── StructuredReport.tsx    # 结构化报告与导出
│   ├── constants/                  # Agent 名称等常量
│   ├── data/                       # DApp 样例数据，用于创建任务下拉列表
│   ├── pages/
│   │   ├── Dashboard.tsx           # 任务详情工作台
│   │   └── TaskList.tsx            # 首页任务列表
│   ├── services/
│   │   ├── api.ts                  # REST API 封装
│   │   └── WebSocketService.ts     # WebSocket 连接与历史事件
│   ├── types/
│   │   └── index.ts                # TypeScript 类型定义
│   ├── App.css
│   ├── App.tsx
│   └── main.tsx
├── AGENT_OBSERVABILITY_INTERVIEW_NOTES.md
├── FRONTEND_REDESIGN_PLAN.md
├── package.json
├── vite.config.ts
└── README.md
```

## 环境要求

| 工具 | 推荐版本 |
| --- | --- |
| Node.js | 18+，推荐 20+ |
| npm | 9+ |
| 后端服务 | TracePilot Backend，默认 `http://localhost:8000` |

## 快速开始

### 1. 先启动后端

前端依赖后端 API 和 WebSocket。请先在后端仓库启动服务：

```bash
cd ../TracePilot-backend
docker-compose up --build
```

确认后端可访问：

```text
http://localhost:8000/docs
```

### 2. 安装前端依赖

```bash
cd ../TracePilot-dashboard
npm install
```

### 3. 配置后端地址

默认后端地址是：

```text
http://localhost:8000
```

如需修改，创建 `.env.local`：

```env
VITE_API_BASE_URL=http://localhost:8000
```

### 4. 启动开发服务

```bash
npm run dev
```

浏览器打开：

```text
http://localhost:5173
```

## 从零跑通一个任务

1. 打开首页 `TracePilot Dashboard`。
2. 点击 `New Task`。
3. 选择一个 DApp，例如 `Audius`。
4. 提交任务后会自动进入任务详情页。
5. 在详情页观察：
   - 左侧 `Agent State`：每个 Agent 的活跃状态和事件数量。
   - 中间 `Log Stream`：实时日志流。
   - 中间 `Timeline`：关键事件时间线。
   - 右侧 `Agent Brief`：Agent 聚合摘要。
   - 右侧 `Final Report`：结构化最终报告和导出按钮。
   - 右侧 `File Logs`：后端持久化的 Agent 原始日志。
6. 任务完成后可执行：
   - `Export MD`：导出审计报告。
   - `Export JSON`：导出证据包。
   - `Archive`：从首页默认列表隐藏但保留记录。
   - `Delete`：删除任务记录和数据库日志。

## 页面说明

### 任务首页

首页用于管理所有分析任务。

- `Active tasks`：默认视图，只看未归档任务。
- `Archived`：查看已归档任务，可恢复。
- `All records`：查看全部任务。
- 状态筛选：`Pending`、`Running`、`Completed`、`Failed`。
- 指标卡：展示当前筛选范围内的任务总数、运行中、已完成、失败数量。

### 任务详情页

任务详情页是主要的分析工作台。

| 区域 | 说明 |
| --- | --- |
| Agent State | 9 个 Agent 的状态和事件数量 |
| Log Stream | 原始实时日志，支持按 Agent、级别、消息类型过滤 |
| Timeline | 将关键状态、工具调用、结果输出、错误告警整理为时间线 |
| Agent Brief | 每个 Agent 的结构化摘要 |
| Final Report | 结构化报告、Raw Report、Markdown/JSON 导出 |
| File Logs | 查看后端 `agents/logs` 下的本地 Agent 日志 |
| Task | 任务 ID、状态、创建时间、完成时间、错误信息 |

## API 对接

前端 API 封装位于 `src/services/api.ts`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/tasks` | 获取未归档任务 |
| `GET` | `/api/tasks?include_archived=true` | 获取全部任务 |
| `POST` | `/api/tasks` | 创建任务 |
| `GET` | `/api/tasks/{task_id}` | 获取任务详情 |
| `POST` | `/api/tasks/{task_id}/cancel` | 取消任务 |
| `POST` | `/api/tasks/{task_id}/archive` | 归档任务 |
| `POST` | `/api/tasks/{task_id}/unarchive` | 恢复归档任务 |
| `DELETE` | `/api/tasks/{task_id}` | 删除任务 |
| `GET` | `/api/task/{task_id}/log/{log_id}` | 获取完整日志 |
| `GET` | `/api/tasks/{task_id}/agent-log-files` | 获取 Agent 文件日志列表 |
| `GET` | `/api/tasks/{task_id}/agent-log-files/{file_id}` | 读取 Agent 文件日志 |
| `WS` | `/ws/{task_id}` | 任务状态和实时日志推送 |

## 常用命令

```bash
# 启动开发服务
npm run dev

# TypeScript 编译 + Vite 打包
npm run build

# ESLint 检查
npm run lint

# 本地预览打包结果
npm run preview
```

## 开发约定

- 页面级组件放在 `src/pages`。
- 可复用组件放在 `src/components`。
- 后端接口统一写在 `src/services/api.ts`。
- WebSocket 状态和历史事件统一由 `WebSocketService` 管理。
- 后端返回结构变化时，同步更新 `src/types/index.ts`。
- 组件命名使用 `PascalCase`，变量和函数命名使用 `camelCase`。
- 提交信息建议使用 `feat: ...`、`fix: ...`、`docs: ...` 等前缀。

## 常见问题

### 1. 页面提示 `Failed to fetch tasks`

通常是后端没有启动，或 `VITE_API_BASE_URL` 配置错误。先确认：

```text
http://localhost:8000/docs
```

### 2. 创建任务后没有日志

检查后端容器日志：

```bash
docker-compose logs -f backend
```

常见原因包括 LLM API Key、Tenderly API Key、网络访问或链上数据接口异常。

### 3. WebSocket 频繁断开

可能是后端任务异常退出、浏览器刷新、代理超时或网络波动。任务完成后仍可通过数据库日志和 `File Logs` 恢复大部分上下文。

### 4. 为什么归档后首页看不到任务？

这是预期行为。归档任务不会被删除，只是从 `Active tasks` 隐藏。切换到 `Archived` 或 `All records` 即可查看。

### 5. 打包时提示 chunk 过大

当前项目包含较多 DApp JSON 样例，Vite 可能提示 chunk size warning。该提示不影响运行。后续可以考虑按 DApp 数据做动态加载或拆包。

## 相关文档

- [工程化可观测性与报告导出说明](./AGENT_OBSERVABILITY_INTERVIEW_NOTES.md)
- [前端重设计计划](./FRONTEND_REDESIGN_PLAN.md)
