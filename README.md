# TracePilot Dashboard

TracePilot Dashboard 是 TracePilot 多智能体 DApp 漏洞定位系统的前端工作台。它用于创建分析任务、观察 Agent 状态、查看实时/历史日志，并把最终结果组织成结构化审计报告、学习导览和可复现证据视图。

这个前端的目标不是简单渲染 Markdown，而是把长链 Agent 分析过程做成可观察、可复盘、可导出、可演示的工程化平台。

## 核心能力

- **任务管理**：创建、查看、取消、归档、恢复、删除分析任务。
- **多模式工作台**：支持报告、学习、审计、原始日志四种模式，面向不同用户角色。
- **结构化最终报告**：将最终报告拆成漏洞根因、攻击路径、关键交易、补丁建议、验证结果等区块。
- **宏观分析面板**：展示地址角色、攻击交易、辅助交易、微观调试目标和宏观漏洞摘要。
- **学习导览**：结合 DApp 背景、参考链接和攻击阶段，帮助用户理解漏洞案例。
- **Raw Mode 隔离**：原始日志、文件日志和完整时间线集中放在 Raw 模式，避免干扰普通用户。
- **长日志支持**：日志流支持虚拟滚动和分页恢复，可加载更长任务的历史日志。
- **Evidence Drawer**：点击报告结论、攻击阶段、关键交易可查看关联证据。
- **Evidence Intelligence**：对证据按来源、工具调用、交易哈希、Agent 结果和安全关键词打分，提示证据健康度与风险。
- **报告导出**：支持导出 Markdown 审计报告和 JSON evidence package。

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
│   ├── components/
│   │   ├── AgentFileLogs.tsx         # Agent 文件日志查看
│   │   ├── AgentInsights.tsx         # Agent 摘要
│   │   ├── AgentNavigator.tsx        # Agent 状态导航
│   │   ├── AgentTimeline.tsx         # Agent 时间线
│   │   ├── AttackReplayTimeline.tsx  # 攻击复盘时间线
│   │   ├── DappContextButton.tsx     # DApp 背景信息抽屉
│   │   ├── EvidenceDrawer.tsx        # 证据详情抽屉
│   │   ├── EvidenceIntelligencePanel.tsx # 证据评分与健康度面板
│   │   ├── KeyTransactionCards.tsx   # 关键交易卡片
│   │   ├── LearningGuidePanel.tsx    # 学习导览面板
│   │   ├── LogStream.tsx             # 虚拟滚动日志流
│   │   ├── MacroAnalysisPanel.tsx    # 宏观分析面板
│   │   ├── MarkdownRenderer.tsx      # Markdown 渲染
│   │   ├── PatchVerificationPanel.tsx
│   │   └── StructuredReport.tsx
│   ├── config/
│   │   └── appConfig.ts              # 后端 HTTP/WS 地址配置
│   ├── constants/
│   ├── data/                         # DApp 样例元数据
│   ├── pages/
│   │   ├── Dashboard.tsx             # 任务详情工作台
│   │   └── TaskList.tsx              # 首页任务列表
│   ├── services/
│   │   ├── api.ts                    # REST API 封装
│   │   └── WebSocketService.ts       # WebSocket 连接与历史事件
│   ├── types/
│   │   └── index.ts                  # TypeScript 类型定义
│   ├── utils/
│   │   ├── dappMetadata.ts           # DApp 元数据读取
│   │   ├── evidence.ts               # 证据抽取与清洗
│   │   ├── evidenceScoring.ts        # 证据质量评分
│   │   └── i18n.ts                   # 轻量中英文 UI 标签
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

前端依赖后端 REST API 和 WebSocket。请先在后端仓库启动服务：

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

后端地址统一由 `src/config/appConfig.ts` 管理。日常开发可创建 `.env.local` 覆盖：

```env
VITE_BACKEND_HTTP_URL=http://localhost:8000

# 可选；不填时会根据 HTTP 地址自动推导 ws:// 或 wss://
VITE_BACKEND_WS_URL=ws://localhost:8000
```

如果后端上线到 HTTPS 域名，例如：

```env
VITE_BACKEND_HTTP_URL=https://tracepilot-api.example.com
```

前端会自动将 WebSocket 地址推导为 `wss://tracepilot-api.example.com`。旧变量 `VITE_API_BASE_URL` 和 `VITE_WS_BASE_URL` 仍兼容，但新项目建议使用 `VITE_BACKEND_HTTP_URL` 和 `VITE_BACKEND_WS_URL`。

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
3. 选择一个 DApp，例如 `SushiSwap` 或 `Audius`。
4. 提交任务后会自动进入任务详情页。
5. 在详情页观察：
   - 左侧 `Agent State`：每个 Agent 的活跃状态和事件数量。
   - 中间模式切换：`报告 / 学习 / 审计 / 原始`。
   - `报告模式`：查看结构化报告、关键交易、补丁验证结果。
   - `学习模式`：查看漏洞背景、攻击阶段解释和参考链接。
   - `审计模式`：查看宏观分析面板、地址角色、交易分类和调试目标。
   - `原始模式`：查看虚拟滚动日志流、Agent 文件日志和完整时间线。
6. 任务完成后可执行：
   - `Export MD`：导出审计报告。
   - `Export JSON`：导出证据包。
   - `Archive`：从首页默认列表隐藏但保留记录。
   - `Delete`：删除任务记录和数据库日志。

## 页面说明

### 首页

首页用于管理所有分析任务：

- `Active tasks`：默认视图，只看未归档任务。
- `Archived`：查看已归档任务，可恢复。
- `All records`：查看全部任务。
- 状态筛选：`Pending`、`Running`、`Completed`、`Failed`。
- 指标卡：展示当前筛选范围内的任务总数、运行中、已完成、失败数量。

### 任务详情页

任务详情页是主要分析工作台：

| 区域 | 说明 |
| --- | --- |
| Agent State | 9 个 Agent 的状态和事件数量 |
| Report Mode | 结构化最终报告、关键交易、补丁验证、证据抽屉 |
| Learn Mode | DApp 背景、攻击阶段解释、关键交易入口和参考链接 |
| Auditor Mode | 宏观地址角色、攻击/辅助交易、调试目标、漏洞摘要 |
| Raw Mode | 原始日志流、分页恢复、虚拟滚动、文件日志、完整时间线 |
| Agent Brief | 每个 Agent 的结构化摘要 |
| Task | 任务 ID、状态、创建时间、完成时间、错误信息 |

报告模式中的 Evidence Intelligence 会对每个报告区块的证据强度做评分。评分是确定性的启发式规则，不额外调用模型，便于解释和复现。

## API 对接

后端服务地址统一配置在 `src/config/appConfig.ts`，REST API 封装位于 `src/services/api.ts`。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `GET` | `/api/tasks` | 获取未归档任务 |
| `GET` | `/api/tasks?include_archived=true` | 获取全部任务 |
| `POST` | `/api/tasks` | 创建任务 |
| `GET` | `/api/tasks/{task_id}` | 获取任务详情 |
| `GET` | `/api/tasks/{task_id}/macro-analysis` | 获取宏观分析结果 |
| `GET` | `/api/tasks/{task_id}/logs` | 分页获取历史日志 |
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
- 后端地址统一写在 `src/config/appConfig.ts`，避免在业务组件里硬编码 localhost。
- 后端接口统一写在 `src/services/api.ts`。
- WebSocket 状态和历史事件统一由 `WebSocketService` 管理。
- 后端返回结构变化时，同步更新 `src/types/index.ts`。
- 组件命名使用 `PascalCase`，变量和函数命名使用 `camelCase`。
- 原始模型输出和证据正文不做自动翻译，避免审计语义偏差。

## 常见问题

### 1. 页面提示 `Failed to fetch tasks`

通常是后端没有启动，或 `VITE_BACKEND_HTTP_URL` 配置错误。先确认：

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

### 4. Raw Mode 里日志很多会不会卡

Raw Mode 的 `LogStream` 使用虚拟滚动，只渲染可视区域附近的日志；历史日志通过 `/api/tasks/{task_id}/logs` 分页加载，不会一次性渲染所有日志。

### 5. 打包时提示 chunk 过大

当前项目包含较多 DApp JSON 样例和 Markdown 渲染依赖，Vite 可能提示 chunk size warning。该提示不影响运行，后续可以对 DApp 数据和报告组件做动态加载。

## 相关文档

- [工程化可观测性与报告导出说明](./AGENT_OBSERVABILITY_INTERVIEW_NOTES.md)
- [前端重设计计划](./FRONTEND_REDESIGN_PLAN.md)
- 后端：[工程化技术决策记录](../TracePilot-backend/md/TracePilot工程化技术决策记录.md)
