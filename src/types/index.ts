// export enum TaskStatus {
//   PENDING = "pending",
//   RUNNING = "running",
//   COMPLETED = "completed",
//   FAILED = "failed",
// }

// export enum MsgType {
//   TEXT = "text",
//   MARKDOWN = "markdown",
//   INPUT = "input",
//   TOOL_CALL = "tool",
//   TOOL_RESPONSE = "tool_response",
//   RESULT = "result",
// }

// export interface LogMessage {
//   agent: string;
//   level: "info" | "warning" | "error" | "debug";
//   message_type: MsgType;
//   message: string;
//   is_truncated: boolean;
//   timestamp: string;
// }

// export interface Task {
//   task_id: string;
//   dapp_name: string;
//   status: TaskStatus;
//   created_at: string;
//   completed_at?: string;
//   duration?: number;
//   final_report?: string;
// }
/**
 * 任务状态枚举
 */
export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  INFO = "INFO",
  ERROR = "ERROR",
  WARNING = "WARNING",
  DEBUG = "DEBUG",
}

/**
 * 消息类型枚举 - 与后端一致
 */
export enum MsgType {
  MARKDOWN = "markdown",
  TEXT = "text",
  TOOL_CALL = "tool_call",
  RESULT = "result",
}

/**
 * 日志消息接口 - 与后端 LogMessage 完全对应
 */
export interface LogMessage {
  agent: string;              // Agent 名称
  level: LogLevel;            // 日志级别 (INFO/ERROR/WARNING/DEBUG)
  message: string;            // 消息内容
  message_type: MsgType;      // 消息类型 (markdown/text/tool_call/result)
  is_truncated: boolean;      // 是否被截断
  timestamp: string;          // ISO 8601 时间戳
  log_id?: string;            // 可选：日志唯一 ID
}

/**
 * 任务创建请求
 */
export interface TaskCreateRequest {
  dapp_name: string;
}

/**
 * 任务响应数据 - 对应后端 TaskResponse
 */
export interface Task {
  task_id: string;
  dapp_name: string;
  status: TaskStatus;
  created_at: string;         // ISO 8601 时间戳
  completed_at?: string;      // ISO 8601 时间戳
  duration?: number;          // 执行时长（秒）
  result?: any;               // 执行结果
  error?: string;             // 错误信息（如果失败）
}

/**
 * WebSocket 消息类型
 */
export type WSMessageType = 
  | { type: 'CONNECTED'; task_id: string; message: string; timestamp: string }
  | { type: 'PING'; timestamp: string }
  | LogMessage;  // 日志消息直接包含 agent/message_type 等字段