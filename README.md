# AttackPilot Frontend

AttackPilot 前端用于输入交易、选择分析模块、查看任务状态、Agent 日志、攻击路径、证据审查和最终报告。

## 环境要求

- Node.js 20+
- npm 9+
- 后端服务默认运行在 `http://localhost:8000`

## 启动

```bash
npm ci
npm run dev
```

浏览器打开：

```text
http://localhost:5173
```

## 配置后端地址

如需修改后端地址，创建 `.env.local`：

```env
VITE_BACKEND_HTTP_URL=http://localhost:8000
VITE_BACKEND_WS_URL=ws://localhost:8000
```

## 常用命令

```bash
npm run lint
npm run build
npm run preview
```

## 使用入口

- 首页输入单笔或多笔交易 Hash，选择攻击检测、故障定位、补丁生成和补丁验证模块。
- 点击 `SushiSwap` 或 `ApeCoin (APE)` 可以打开示例案例。
- 任务工作区会展示实时 Agent 状态、日志、结构化报告、证据审查和报告导出入口。
