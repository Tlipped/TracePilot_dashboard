# TracePilot Dashboard 工程化改造方案

## 1. 结论

建议不重新开新项目，直接在 `TracePilot-dashboard` 上改造。

现有前端已经具备 React + TypeScript + Vite + Ant Design + WebSocket + ReactMarkdown 的基础能力，且已经接入后端 `/api/tasks`、`/ws/{task_id}` 和任务详情页面。当前主要问题不是技术栈选错，而是信息架构、日志渲染、任务状态复原、智能体状态表达还比较粗糙。因此更适合做一次 dashboard v2 改造，而不是推倒重来。

如果后续要做正式产品化，可以在当前项目里建立 `src/features/*` 模块化结构，逐步替换旧页面。

## 2. 对后端封装的判断

当前 FastAPI 后端已经具备比较完整的工程化雏形：

- `POST /api/tasks` 创建分析任务，并异步启动工作流。
- `GET /api/tasks` 查询任务列表。
- `GET /api/tasks/{task_id}` 查询当前任务状态和最终报告。
- `DELETE /api/tasks/{task_id}` 取消任务。
- `GET /api/task/{task_id}/log/{log_id}` 查询完整日志内容。
- `WS /ws/{task_id}` 实时推送任务状态、日志、最终结果、心跳和背压提示。

优点：

- 任务和日志已经有统一事件流，前端可以基于 `type` 做不同渲染。
- WebSocket 有心跳、断连处理和 outbound queue 背压控制。
- TaskManager 有任务队列、线程池执行、任务状态持久化。
- 日志有 `log_id`，适合前端做“摘要流 + 点击查看完整日志”的交互。
- Redis 适合缓存完整日志，数据库适合保存任务状态、最终报告和日志索引。

需要注意的后端问题：

- `app/database/models.py` 里的 `TaskLog` 字段目前只有 `task_id/log_id/is_truncated/timestamp`，但 `AgentLogger` 写入时使用了 `agent/level/message_type/message/full_content` 等字段，模型定义和写入逻辑不一致。前端要依赖完整日志查询时，最好先修正这个 ORM 模型。
- `GET /api/tasks` 当前只返回内存中的 `TaskManager.tasks`，服务重启后如果没有从数据库恢复任务列表，刷新保存记录会不完整。建议后端启动时从 `task_runs` 恢复历史任务，或增加分页历史任务接口。
- WebSocketService 前端目前忽略 `TASK_STATUS`、`TASK_FINAL`、`LOG_DROPPED` 等控制消息，导致页面无法准确展示任务生命周期。
- 取消任务目前只是 cancel future，但线程池内工作流是否真的中断取决于底层流程是否可取消，前端需要把它视为“请求取消”，不要承诺立即停止。

## 3. Dashboard v2 产品目标

目标不是“把 Markdown 打印到页面”，而是做成一个多智能体分析过程观察台：

- 看到任务是否 pending/running/completed/failed。
- 看到 9 个智能体各自当前状态、日志数量、最近动作和错误状态。
- 实时滚动渲染日志，但默认展示摘要，点击打开完整日志详情。
- 刷新页面后能恢复任务状态和最终报告。
- 能清楚区分普通文本、Markdown、工具调用、模型输出、最终结果、错误日志。
- 能快速筛选 agent、level、message_type。
- 能把最终报告单独以良好的 Markdown 阅读体验呈现。

## 4. 推荐页面结构

### 4.1 TaskList 页面

定位：任务工作台。

建议布局：

- 顶部工具栏：项目名、后端连接状态、刷新按钮、新建任务按钮。
- 左侧或顶部筛选区：按状态、DApp 名、创建时间筛选。
- 主体：任务表格，而不是大卡片堆叠。
- 表格列：DApp、Status、Duration、Created At、Completed At、Log Count、Action。
- Action：进入详情、取消任务、删除任务、查看最终报告。

需要优化：

- DApp 列表不建议硬编码在 `TaskList.tsx`。短期可以从 `src/data` 自动生成，长期建议后端提供 `/api/dapps`。
- 轮询可以保留，但运行中任务详情页应该以 WebSocket 为主。

### 4.2 TaskDetail / Dashboard 页面

定位：单任务实时分析台。

推荐三栏布局：

1. 左侧：Agent Navigator
   - 9 个智能体状态列表。
   - 每个 Agent 显示：状态点、日志数量、错误数、最近更新时间。
   - 点击 Agent 后过滤右侧日志。

2. 中间：Live Event Stream
   - 时间线式日志流。
   - 支持按 Agent、Level、Message Type 过滤。
   - 默认自动滚动到底部，可手动暂停自动滚动。
   - 每条日志只展示摘要，超长内容折叠。
   - 点击日志打开详情 Drawer。

3. 右侧：Inspector / Final Report
   - 当前选中日志详情。
   - 完整 Markdown 渲染。
   - Tool Call 参数和 JSON 结果用代码块高亮。
   - 任务完成后切换到最终报告视图。

### 4.3 Final Report 页面或 Tab

定位：审计报告阅读器。

建议：

- 使用更宽的阅读区域，避免塞在日志卡片里。
- Markdown 样式单独设计，支持目录、代码块、表格、引用块。
- 提供“复制报告”“导出 Markdown”“回到日志证据”的入口。

## 5. 9 个智能体状态设计

当前系统涉及这些智能体：

- `TxDetailAgent`：交易详情摘要。
- `TxRoleAgent`：交易角色和地址角色分析。
- `Transaction Filter`：同构攻击交易过滤。
- `TxFaultAgent`：宏观故障现象总结。
- `Task Organizer`：任务树和可疑函数维护。
- `Transaction Debugger`：Trace 调试和工具调用。
- `GlobalMemory Administrator`：全局记忆融合。
- `Code Patcher`：补丁生成和应用。
- `Transaction Judge`：补丁验证裁决。

前端可维护一个 Agent 状态机：

- `idle`：暂无日志。
- `running`：最近 30 秒内有日志，或任务运行中且该 Agent 已开始。
- `waiting`：已有日志但最近无更新。
- `warning`：最近有 warning。
- `error`：最近有 error。
- `done`：任务完成且该 Agent 有输出。

Agent 卡片不建议每个都放一个小滚动日志框。九个滚动框会分散注意力，也会让 Markdown 变丑。更推荐“左侧 Agent 状态 + 中间统一日志流 + 点击过滤”。

## 6. 日志渲染组件需求

### 6.1 LogStream

职责：统一滚动日志流。

能力：

- 虚拟列表，避免 5000 条日志卡顿。
- 自动滚动开关。
- 支持关键词搜索。
- 支持 Agent、Level、Message Type 筛选。
- 支持 `LOG_DROPPED` 控制消息展示为系统提示。
- 支持 `TASK_STATUS` 和 `TASK_FINAL` 展示为任务事件。

### 6.2 LogEventItem

职责：单条日志摘要。

展示字段：

- 时间。
- Agent。
- Level。
- Message Type。
- 摘要内容。
- 是否截断。
- 是否有 `log_id` 可查看完整内容。

交互：

- 点击打开详情 Drawer。
- 错误日志突出显示。
- 工具调用日志用扳手/代码图标。
- Result 日志用输出图标。

### 6.3 LogDetailDrawer

职责：完整日志查看。

能力：

- 如果日志有 `log_id`，调用 `GET /api/task/{task_id}/log/{log_id}` 拉取完整内容。
- Markdown 使用专门的 `MarkdownRenderer`。
- JSON 内容使用格式化代码块。
- 可复制全文。
- 展示来源：`cache` 或 `database`。

### 6.4 MarkdownRenderer

职责：让大模型输出更像工程文档。

建议：

- `react-markdown + remark-gfm` 保留。
- 增加代码块样式，最好后续引入 `rehype-highlight` 或 `shiki`。
- 表格做横向滚动，不要挤爆容器。
- 标题层级要有清晰间距。
- 行内 code 和地址/hash 使用等宽字体。
- 对超长 hash/address 做中间省略，但 hover/click 可查看完整值。

### 6.5 AgentTimeline / StageStepper

职责：把分析过程从“日志堆”转成“阶段进度”。

可以根据 Agent 首次日志和消息类型推断阶段：

1. Transaction Loading
2. Role Analysis
3. Attack Filtering
4. Fault Summary
5. Task Planning
6. Trace Debugging
7. Memory Update
8. Patch Generation
9. Verification
10. Final Report

这部分不要求后端立刻改接口，前端可以先用日志事件推断。

## 7. 色调主题想象

建议走“专业安全运营台”风格，不要做花哨科幻风。

主题关键词：

- 深色，但不要纯黑。
- 信息密度高，但层级清楚。
- 少用大面积蓝紫渐变。
- 用颜色表达状态，而不是装饰。

推荐色板：

- 背景：`#0B0F14`
- 面板：`#111827`
- 次级面板：`#162033`
- 边框：`#263244`
- 主文本：`#E5E7EB`
- 次文本：`#94A3B8`
- 弱文本：`#64748B`
- 主强调：`#38BDF8` 或 `#2DD4BF`
- 成功：`#22C55E`
- 警告：`#F59E0B`
- 错误：`#EF4444`
- Debug：`#A78BFA`

视觉原则：

- 卡片圆角不超过 8px。
- 日志流用紧凑列表，不用一堆大卡片。
- 按钮尽量图标 + tooltip，比如刷新、暂停滚动、清空过滤、复制。
- Markdown 报告使用浅一点的面板背景，提升阅读体验。
- 表格、代码块、日志都使用等宽数字和等宽代码字体。

## 8. 是否需要后端新增接口

短期不需要，当前接口可以做出可用 v2。

为了更好工程化，建议后续补充：

- `GET /api/dapps`：返回可分析 DApp 列表，替代前端硬编码。
- `GET /api/tasks/{task_id}/logs?cursor=&limit=&agent=&level=`：支持刷新后恢复历史日志，而不是只靠当前 WebSocket 内存历史。
- `GET /api/tasks/{task_id}/agents`：返回各 Agent 状态和统计。
- `POST /api/tasks/{task_id}/replay`：重新推送历史日志，用于前端回放。
- `GET /api/health`：前端展示后端、Redis、数据库状态。

同时修复 `TaskLog` ORM 字段，保证完整日志可持久化查询。

## 9. 推荐实施路径

### Phase 1：不动后端，先重构前端体验

- 新建 `src/features/tasks`、`src/features/logs`、`src/features/agents`。
- 抽出 API client 和 WebSocket event parser。
- 统一处理 `LOG/TASK_STATUS/TASK_FINAL/LOG_DROPPED/CONNECTED/PING`。
- 改 Dashboard 为三栏布局。
- 实现 LogStream、LogEventItem、LogDetailDrawer、MarkdownRenderer。
- 支持刷新后通过 `GET /api/tasks/{task_id}` 恢复任务状态和 final_report。

### Phase 2：后端补历史日志能力

- 修复 `TaskLog` 字段。
- 增加日志分页查询接口。
- 启动时从数据库恢复历史任务列表。
- 增加 `/api/dapps` 和 `/api/health`。

### Phase 3：做工程化亮点

- Agent 阶段时间线。
- 工具调用可视化。
- Trace 节点引用跳转。
- 最终报告和证据链联动。
- 历史任务对比和失败原因统计。

## 10. 面试/答辩时可以怎么讲

可以这样表达：

> 我后端不是单纯把模型日志打到前端，而是把多智能体分析过程事件化。任务状态、Agent 日志、工具调用、最终报告都通过统一事件流推送；完整日志通过 Redis 和数据库做可追溯存储。前端规划上，我会把它做成一个 Agent Observability Dashboard：左侧看智能体状态，中间看实时事件流，右侧看日志详情和最终报告。这样系统从科研脚本变成了可交互、可复现、可排障的平台。

## 11. 最小可交付版本

最小版本建议包含：

- 任务列表：创建、查看、取消、删除入口。
- 任务详情：任务状态条 + 9 个 Agent 状态导航 + 统一日志流。
- 日志详情：点击日志后用 Drawer 展示完整 Markdown/JSON。
- 最终报告：任务完成后单独 Tab 展示。
- 刷新恢复：页面刷新后通过任务详情接口恢复状态和最终报告，WebSocket 继续接收新事件。
