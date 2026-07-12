# AttackPilot Frontend

AttackPilot 是一个面向链上攻击复盘的可视化工作台。前端负责交易输入、案例选择、分析模块配置、Agent 状态展示、日志查看、攻击路径与证据审查、漏洞教学和报告导出。

项目配合 AttackPilot 后端使用，也保留了离线缓存案例兜底逻辑，便于演示和截图。

## 核心功能

- **交易入口**：支持输入单笔或多笔交易 Hash，并选择攻击检测、故障定位、补丁生成和补丁验证模块。
- **任务工作台**：展示任务进度、实时 Agent 状态、日志流、关键交易、结构化报告和一致性审查。
- **案例复盘**：可直接打开 SushiSwap、ApeCoin 等已整理案例，快速查看复盘结果。
- **漏洞学习**：以真实案例、PoC 思路、链上信号和修复建议组织漏洞教程。
- **取证助手**：绑定当前任务上下文，支持围绕攻击路径、证据和修复方向继续追问。

## 技术栈

- React 18
- TypeScript
- Vite
- Ant Design
- WebSocket

## 快速启动

```powershell
cd F:\keyan_learning\TracePilot-dashboard
npm install
npm run dev
```

浏览器访问：

```text
http://localhost:5173
```

默认后端地址为：

```text
http://localhost:8000
ws://localhost:8000
```

如需修改，在项目根目录创建 `.env.local`：

```env
VITE_BACKEND_HTTP_URL=http://localhost:8000
VITE_BACKEND_WS_URL=ws://localhost:8000
```

## 常用命令

```powershell
npm run test:smoke
npm run lint
npm run build
npm run preview
```

其中 `npm run test:smoke` 用于快速检查前端关键入口、模块联动、离线缓存兜底和中文文案风险，不需要启动完整系统。

## 与后端联调

1. 先启动 AttackPilot 后端。
2. 再启动前端开发服务。
3. 首页输入交易 Hash 或打开已发生案例复盘。
4. 进入工作台查看实时日志、Agent 状态、攻击路径、证据审查和报告。

如果后端暂时不可用，前端会尝试使用本地缓存案例作为演示兜底。当前缓存数据是否完整，可通过 `npm run test:smoke` 查看提示。
