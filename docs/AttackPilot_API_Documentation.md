# AttackPilot API 文档

本文档整理 AttackPilot 前后端交互所需的主要接口，适用于项目交付、部署说明和二次开发。后端服务基于 FastAPI 实现，默认本地地址为 `http://localhost:8000`，WebSocket 默认地址为 `ws://localhost:8000/ws/{task_id}`。生产环境地址可通过前端环境变量 `VITE_BACKEND_HTTP_URL` 和 `VITE_BACKEND_WS_URL` 配置。

## 1. 通用说明

### 1.1 数据格式

- 请求体默认使用 `application/json`。
- 响应体默认为 JSON。
- 时间字段采用 ISO 8601 字符串。
- `task_id` 为任务唯一标识。
- `tx_hash` 为链上交易 Hash，当前默认链为 `ethereum`。

### 1.2 任务状态

任务状态字段 `status` 取值如下：

| 状态 | 含义 |
| --- | --- |
| `pending` | 任务已创建，等待执行 |
| `running` | 任务正在分析 |
| `completed` | 任务已完成 |
| `failed` | 任务执行失败 |

### 1.3 通用错误

常见错误响应：

```json
{
  "detail": "Task not found"
}
```

常见状态码：

| 状态码 | 含义 |
| --- | --- |
| `400` | 请求参数不合法 |
| `403` | 当前部署禁止该操作 |
| `404` | 资源不存在 |
| `409` | 任务状态不允许当前操作 |
| `500` | 服务端执行失败 |

## 2. DApp 与案例目录

### 2.1 获取 DApp 案例列表

`GET /api/dapps`

用于获取本地案例库中的 DApp 攻击事件，前端首页和缓存案例入口使用该接口。

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `total` | number | 案例总数 |
| `demo_ready_count` | number | 已具备处理结果、可直接演示的案例数 |
| `items` | array | 案例列表 |

`items` 中的主要字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | DApp 或攻击案例名称 |
| `cause` | string | 原始风险标签 |
| `platform` | string | 所属链或平台 |
| `time` | string | 事件时间 |
| `root_cause` | string | 根因摘要 |
| `report_link` | string | 外部报道或复盘链接 |
| `transaction_hash` | string[] | 关联交易 Hash 列表 |
| `transaction_count` | number | 关联交易数量 |
| `has_processed_analysis` | boolean | 是否已有处理后的宏观分析结果 |
| `demo_ready` | boolean | 是否适合直接打开演示 |

示例响应：

```json
{
  "total": 3,
  "demo_ready_count": 3,
  "items": [
    {
      "name": "SushiSwap",
      "platform": "Ethereum",
      "root_cause": "bridgeFor 默认路由逻辑导致低流动性池被利用",
      "transaction_hash": ["0x..."],
      "transaction_count": 3,
      "has_processed_analysis": true,
      "demo_ready": true
    }
  ]
}
```

## 3. 任务管理接口

### 3.1 创建 DApp 分析任务

`POST /api/tasks`

根据 DApp 案例名称创建并启动一次分析任务。

请求体：

```json
{
  "dapp_name": "SushiSwap"
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task_id` | string | 任务 ID |
| `dapp_name` | string | 案例名称 |
| `status` | string | 任务状态 |
| `created_at` | string | 创建时间 |
| `completed_at` | string/null | 完成时间 |
| `duration` | number/null | 执行耗时，单位秒 |
| `final_report` | string/null | 最终 Markdown 报告 |
| `result` | object/null | 结构化结果 |
| `error` | string/null | 错误信息 |
| `archived` | boolean | 是否已归档 |

### 3.2 获取任务详情

`GET /api/tasks/{task_id}`

用于恢复任务状态、展示最终报告和任务结果。

### 3.3 获取任务列表

`GET /api/tasks?include_archived=false`

查询任务库。`include_archived` 控制是否返回已归档任务。

### 3.4 取消任务

`POST /api/tasks/{task_id}/cancel`

取消尚未完成的任务。

响应示例：

```json
{
  "message": "Task cancelled"
}
```

### 3.5 删除任务

`DELETE /api/tasks/{task_id}`

删除已完成或失败的任务。公开演示部署中可通过 `DISABLE_TASK_DELETE` 禁止删除。

### 3.6 归档任务

`POST /api/tasks/{task_id}/archive`

将任务从默认任务列表中归档。

### 3.7 取消归档任务

`POST /api/tasks/{task_id}/unarchive`

恢复已归档任务。

## 4. 交易 Hash 审查接口

### 4.1 轻量交易审查

`POST /api/tx-review`

输入一笔交易 Hash，系统先检索本地攻击案例，再尝试读取链上 receipt、trace、调用和 token 变化，返回风险线索和是否建议进入深度分析。

请求体：

```json
{
  "tx_hash": "0x...",
  "chain": "ethereum"
}
```

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `tx_hash` | string | 标准化后的交易 Hash |
| `chain` | string | 链名称 |
| `risk_level` | string | 风险等级，如 `high`、`medium`、`low`、`unknown` |
| `tx_type` | string | 交易类型，如 `known_attack_case` 或 `unreviewed_transaction` |
| `summary` | string | 审查摘要 |
| `signals` | string[] | 风险信号名称 |
| `signal_details` | array | 风险信号详情 |
| `evidence` | array | 证据条目 |
| `metrics` | object | 链上观察指标 |
| `live_observation_status` | string | 链上观察状态 |
| `matched_cases` | array | 命中的本地案例 |
| `recommend_deep_analysis` | boolean | 是否建议深度复盘 |
| `deep_analysis_ready` | boolean | 是否具备启动深度复盘的条件 |

`signal_details` 结构：

```json
{
  "id": "known_case_match",
  "name": "命中本地攻击案例",
  "level": "high",
  "summary": "该交易已出现在本地真实攻击案例库中。",
  "evidence": "matched case = SushiSwap",
  "confidence": "high"
}
```

### 4.2 启动交易深度分析

`POST /api/tx-review/deep-analysis`

对交易 Hash 启动深度分析。如果命中已知案例，则创建对应 DApp 任务；如果未命中，则创建临时交易任务。

请求体：

```json
{
  "tx_hash": "0x...",
  "chain": "ethereum"
}
```

响应同 `TaskResponse`。

## 5. 宏观分析与自动审查

### 5.1 获取宏观分析结果

`GET /api/tasks/{task_id}/macro-analysis`

读取任务对应的宏观交易分析结果。该接口主要用于展示关键交易、攻击阶段、角色识别和资金变化等内容。

说明：

- 如果已有处理后的案例文件，接口直接读取结构化 JSON。
- 如果任务不存在，返回 `404`。
- 如果该任务暂无宏观分析结果，返回 `404`。

### 5.2 获取自动一致性审查

`GET /api/tasks/{task_id}/automated-review?log_limit=2000`

根据任务日志、最终报告和宏观分析结果生成一致性审查，用于检查关键交易、根因函数、证据链和补丁验证之间是否存在缺口或冲突。

参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `log_limit` | number | `2000` | 读取的日志数量上限，范围 1-5000 |

## 6. 日志接口

### 6.1 分页获取任务日志

`GET /api/tasks/{task_id}/logs?limit=200&before_id=`

用于前端原始日志视图和任务恢复。日志按页返回，支持向前翻页。

参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `limit` | number | `200` | 每页日志数量，范围 1-1000 |
| `before_id` | number/null | null | 获取指定日志 ID 之前的更早日志 |

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `events` | array | 日志事件 |
| `next_before_id` | number/null | 下一页游标 |
| `has_more` | boolean | 是否还有更早日志 |
| `total` | number | 当前任务日志总数 |

日志事件结构：

```json
{
  "type": "LOG",
  "task_id": "task-id",
  "agent": "Transaction Debugger",
  "level": "info",
  "message_type": "markdown",
  "message": "日志摘要或截断内容",
  "is_truncated": false,
  "timestamp": "2026-06-24T10:00:00",
  "log_id": "uuid"
}
```

### 6.2 获取完整日志内容

`GET /api/task/{task_id}/log/{log_id}`

用于展开某条被截断的日志。服务端会先查 Redis 热缓存，未命中时回退到 PostgreSQL。

响应示例：

```json
{
  "content": "完整日志内容",
  "source": "cache"
}
```

`source` 可能为：

| 值 | 说明 |
| --- | --- |
| `cache` | 来自 Redis 短期缓存 |
| `database` | 来自 PostgreSQL 持久化记录 |

### 6.3 获取 Agent 原始日志文件列表

`GET /api/tasks/{task_id}/agent-log-files`

返回后端运行目录中与任务相关的 Agent 原始日志文件。

### 6.4 获取 Agent 原始日志文件内容

`GET /api/tasks/{task_id}/agent-log-files/{file_id}?max_bytes=`

读取指定 Agent 日志文件内容。`file_id` 由文件列表接口返回，不应由前端自行拼接路径。

## 7. 漏洞知识库接口

### 7.1 获取漏洞类型列表

`GET /api/knowledge/vulnerabilities`

返回漏洞教程和知识库中的漏洞类型列表，例如预言机操纵、重入攻击、权限控制缺陷等。

响应示例：

```json
{
  "total": 9,
  "items": [
    {
      "id": "oracle_manipulation",
      "name_zh": "预言机操纵",
      "name_en": "Oracle Manipulation",
      "one_liner": "协议相信了可以在同一笔交易内被临时推高或压低的价格。"
    }
  ]
}
```

### 7.2 获取单个漏洞类型详情

`GET /api/knowledge/vulnerabilities/{type_id}`

返回指定漏洞类型的解释、Trace 信号、修复提示和教学内容。

### 7.3 获取案例知识库列表

`GET /api/knowledge/cases?source=curated&type_id=&q=`

参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `source` | string | `curated` | `curated` 为人工整理案例，`generated` 为自动生成索引 |
| `type_id` | string/null | null | 按漏洞类型过滤 |
| `q` | string/null | null | 按关键词搜索 |

### 7.4 获取单个案例详情

`GET /api/knowledge/cases/{case_id}?source=curated`

返回指定案例的背景、漏洞类型、根因摘要和学习材料。

### 7.5 获取知识库摘要

`GET /api/knowledge/summary`

返回漏洞类型数量、精选案例数量、外部案例数量、自动索引案例数量和知识来源。

### 7.6 RAG 知识库检索

`GET /api/rag/status`

返回当前 RAG 索引是否存在、知识片段数量、更新时间和索引模式。

`POST /api/rag/rebuild`

重新构建本地知识库索引。索引来源包括漏洞类型、精选案例和自动生成案例索引。

`POST /api/rag/search`

请求体：

```json
{
  "query": "oracle manipulation flash loan",
  "top_k": 5,
  "filters": {}
}
```

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `query` | string | 本次检索问题 |
| `total` | number | 命中的候选知识片段数量 |
| `items` | array | 召回结果，包含标题、来源、内容、标签、相似度分数和元数据 |
| `index` | object | 当前索引状态 |

该接口用于首页知识库检索、学习导览的相似案例召回，以及取证助手生成回答时的参考上下文。

## 8. 取证助手接口

### 8.1 与取证助手对话

`POST /api/assistant/chat`

根据当前页面上下文回答问题。取证助手可以绑定交易审查、具体任务或漏洞知识库，用于解释攻击路径、风险信号、Agent 日志和漏洞教程。

请求体：

```json
{
  "scope": "task",
  "question": "这次攻击最关键的证据是什么？",
  "task_id": "task-id",
  "tx_hash": "0x...",
  "chain": "ethereum",
  "history": [
    {
      "role": "user",
      "content": "先解释一下攻击背景"
    },
    {
      "role": "assistant",
      "content": "这是一次..."
    }
  ]
}
```

字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `scope` | string | 对话范围，取值 `general`、`tx_review`、`task`、`knowledge` |
| `question` | string | 用户问题，长度 1-2000 |
| `task_id` | string/null | 绑定任务 ID |
| `tx_hash` | string/null | 绑定交易 Hash |
| `chain` | string | 链名称，默认 `ethereum` |
| `history` | array | 最近对话历史，最多 8 条 |

响应字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `answer` | string | 助手回答 |
| `scope` | string | 对话范围 |
| `model` | string | 使用的大模型名称 |
| `sources` | array | 回答引用的任务、交易或知识库上下文 |
| `suggested_questions` | string[] | 推荐追问 |
| `used_fallback` | boolean | 大模型不可用时是否使用降级回答 |

## 9. WebSocket 实时任务通道

### 9.1 建立连接

`WS /ws/{task_id}`

前端在任务工作区打开该连接，实时接收 Agent 日志、任务状态、心跳和最终结果。

连接建立后，服务端会发送：

```json
{
  "type": "CONNECTED",
  "task_id": "task-id",
  "message": "WebSocket connected successfully",
  "timestamp": "2026-06-24T10:00:00"
}
```

随后发送当前任务状态：

```json
{
  "type": "TASK_STATUS",
  "task_id": "task-id",
  "dapp_name": "SushiSwap",
  "status": "running",
  "created_at": "2026-06-24T10:00:00",
  "completed_at": null,
  "duration": null,
  "error": null,
  "archived": false
}
```

### 9.2 服务端消息类型

| 类型 | 说明 |
| --- | --- |
| `CONNECTED` | WebSocket 已连接 |
| `TASK_STATUS` | 当前任务状态 |
| `LOG` | Agent 日志 |
| `LOG_DROPPED` | 队列拥塞时部分实时日志被丢弃，历史日志仍可从分页接口恢复 |
| `PING` | 服务端心跳 |
| `PONG` | 服务端响应客户端心跳 |
| `HEARTBEAT_TIMEOUT` | 心跳超时 |
| `TASK_FINAL` | 任务最终结果 |

客户端收到 `PING` 后建议回复：

```json
{
  "type": "PONG"
}
```

### 9.3 实时日志消息

```json
{
  "type": "LOG",
  "task_id": "task-id",
  "agent": "TxFaultAgent",
  "level": "info",
  "message": "正在分析关键 Trace 节点...",
  "message_type": "text",
  "is_truncated": false,
  "timestamp": "2026-06-24T10:00:00",
  "log_id": "uuid"
}
```

## 10. 部署与环境依赖摘要

后端运行环境：

| 项目 | 配置 |
| --- | --- |
| Python | `python:3.10-slim-bookworm` |
| Web 框架 | FastAPI、Uvicorn、WebSockets |
| 数据库 | PostgreSQL 15 |
| 缓存 | Redis 7 |
| 链上交互 | web3、eth_abi、eth_utils、JSON-RPC、Etherscan API |
| 模型调用 | OpenAI-compatible API，使用 `LLM_NAME`、`LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MAX_CONCURRENT` 配置 |
| 交易模拟与 Trace | Tenderly API、Phalcon/Tenderly Trace、合约源码缓存 |
| 容器化 | Docker Compose |

主要环境变量：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接地址 |
| `REDIS_URL` | Redis 连接地址 |
| `PROJECT_PATH` | 后端项目路径 |
| `CACHE_DIR` | 链上数据、源码、Trace 和中间结果缓存目录 |
| `LLM_NAME` | 大模型名称 |
| `LLM_API_KEY` | 大模型 API Key |
| `LLM_BASE_URL` | 大模型服务地址 |
| `LLM_MAX_CONCURRENT` | 模型调用并发上限 |
| `TENDERLY_API_KEY` | Tenderly API Key |
| `DISABLE_TASK_DELETE` | 是否禁用公开演示环境中的任务删除 |

说明：PostgreSQL 用于持久化任务、报告和日志；Redis 用于运行时热缓存，例如完整日志的短期缓存和高频读取内容。Redis 中日志缓存默认设置过期时间，不能视为长期存储。
