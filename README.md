# TracePilot Dashboard

TracePilot Dashboard 是一个用于监控和分析区块链智能合约交易问题的实时仪表板，通过多智能体系统对交易进行故障排查、角色识别与详细分析。

## 目录

- 项目概述
- 功能特性
- 技术栈
- 目录结构
- 上手指南
- 使用方法
- API 接口
- 编码规范
- 开发指南

------

## 项目概述

TracePilot Dashboard 为区块链开发者提供交易监控与智能合约分析的前端界面。系统通过多智能体协作处理交易数据，主要能力包括：

- 交易过滤与分类
- 交易细节分析
- 故障检测与诊断
- 角色识别与权限分析
- 实时日志监控

------

## 功能特性

| 功能模块     | 说明                               |
| :----------- | :--------------------------------- |
| 实时监控     | 基于 WebSocket 实时接收智能体日志  |
| 多智能体协作 | 不同职能智能体协同完成交易分析     |
| 任务管理     | 创建、管理与监控多个分析任务       |
| 可视化界面   | 基于 Ant Design 的现代化 UI 组件库 |
| 响应式设计   | 支持桌面端与移动端访问             |

------

## 技术栈

| 类别      | 技术         |
| :-------- | :----------- |
| 前端框架  | React        |
| 类型系统  | TypeScript   |
| UI 组件库 | Ant Design   |
| 实时通信  | WebSocket    |
| 路由管理  | React Router |
| HTTP 请求 | Axios        |

------

## 目录结构

text

```
TracePilot-dashboard/
├── src/
│   ├── components/                 # 可复用组件
│   │   └── AgentMonitorCard.tsx    # 智能体监控卡片
│   ├── data/                       # 测试数据（各 DApp 样例）
│   │   └── *.json
│   ├── pages/                      # 页面组件
│   │   ├── Dashboard.tsx           # 主仪表板（实时日志）
│   │   └── TaskList.tsx            # 任务列表与任务管理
│   ├── services/                   # 服务层
│   │   └── WebSocketService.ts     # WebSocket 连接管理
│   ├── types/                      # TypeScript 类型定义
│   │   └── index.ts
│   ├── assets/                     # 静态资源
│   ├── App.tsx                     # 应用入口组件
│   └── main.tsx                    # React 启动入口
├── public/                         # 公共资源
├── package.json                    # 依赖与脚本配置
├── tsconfig.json                   # TypeScript 编译配置
└── README.md                       # 项目说明
```



------

## 上手指南

### 环境要求

| 工具        | 版本要求   |
| :---------- | :--------- |
| Node.js     | 18+        |
| npm 或 yarn | 最新稳定版 |

### 安装步骤

1. **克隆项目**

   bash

   ```
   git clone <repository-url>
   cd TracePilot-dashboard
   ```

   

2. **安装依赖**

   bash

   ```
   npm install
   # 或
   yarn install
   ```

   

3. **启动开发服务器**

   bash

   ```
   npm run dev
   # 或
   yarn dev
   ```

   

4. **访问应用**

   浏览器打开 `http://localhost:5173`

------

## 使用方法

1. **进入任务列表页面**，点击 `CREATE TASK` 按钮。
2. **选择 DApp**：从下拉列表中选取待分析的 DApp。
3. **启动任务**：点击 `Start` 创建分析任务。
4. **查看分析结果**：点击任务卡片，进入仪表板页面，查看实时智能体日志与诊断信息。

------

## API 接口

| 接口           | 方法      | 说明                   |
| :------------- | :-------- | :--------------------- |
| `/api/tasks`   | GET       | 获取任务列表           |
| `/api/tasks`   | POST      | 创建新分析任务         |
| `/ws/{taskId}` | WebSocket | 接收指定任务的实时日志 |

------

## 编码规范

### TypeScript 规范

- 组件与接口使用 `PascalCase` 命名
- 变量与函数使用 `camelCase` 命名
- 所有组件需提供明确的类型注解
- 使用 `interface` 定义对象结构

### React 组件规范

- 使用函数组件与 Hooks
- 组件文件使用 `.tsx` 扩展名
- 每个文件仅导出一个主要组件
- Props 类型定义需清晰、完整

### 样式规范

- 优先使用 Ant Design 组件库，保持视觉一致性
- 采用内联样式或 CSS Modules，避免全局样式污染
- 遵循深色主题设计风格

### 提交规范

- 提交信息格式：`<type>: <subject>`
- 示例：`feat: 添加 WebSocket 连接重试机制`
- 常用类型：`feat`、`fix`、`docs`、`style`、`refactor`、`test`、`chore`

------

## 开发指南

### 添加新页面

1. 在 `src/pages` 目录下创建新页面组件
2. 在 `App.tsx` 中添加对应路由配置

### 添加新组件

1. 在 `src/components` 目录下创建组件文件
2. 使用描述性命名，并导出供其他模块使用

### 数据流说明

- 任务列表从后端 API 拉取
- 用户选择 DApp 后创建新任务
- 通过 WebSocket 接收实时日志
- 日志按智能体分组在仪表板中展示