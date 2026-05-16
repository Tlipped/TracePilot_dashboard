export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
}

export enum LogLevel {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  DEBUG = "debug",
}

export enum MsgType {
  TEXT = "text",
  MARKDOWN = "markdown",
  TOOL_CALL = "tool",
  RESULT = "result",
}

export interface LogMessage {
  type: "LOG";
  task_id?: string;
  agent: string;
  level: LogLevel;
  message: string;
  message_type: MsgType;
  is_truncated: boolean;
  timestamp: string;
  log_id?: string;
}

export interface TaskCreateRequest {
  dapp_name: string;
}

export interface Task {
  task_id: string;
  dapp_name: string;
  status: TaskStatus;
  created_at: string;
  completed_at?: string | null;
  duration?: number | null;
  final_report?: string | null;
  result?: unknown;
  error?: string | null;
  archived?: boolean;
}

export interface ConnectedEvent {
  type: "CONNECTED";
  task_id: string;
  message: string;
  timestamp: string;
}

export interface PingEvent {
  type: "PING";
  task_id?: string;
  timestamp: string;
}

export interface PongEvent {
  type: "PONG";
  task_id?: string;
  timestamp: string;
}

export interface TaskStatusEvent {
  type: "TASK_STATUS";
  task_id: string;
  dapp_name: string;
  status: TaskStatus;
  created_at?: string;
  completed_at?: string | null;
  duration?: number | null;
  error?: string | null;
  archived?: boolean;
}

export interface TaskFinalEvent {
  type: "TASK_FINAL";
  task_id: string;
  dapp_name: string;
  status: TaskStatus;
  completed_at?: string | null;
  duration?: number | null;
  final_report?: string | null;
  error?: string | null;
  archived?: boolean;
}

export interface LogDroppedEvent {
  type: "LOG_DROPPED";
  task_id: string;
  count: number;
  message: string;
  timestamp: string;
}

export interface HeartbeatTimeoutEvent {
  type: "HEARTBEAT_TIMEOUT";
  task_id: string;
  message: string;
  timestamp: string;
}

export type TaskEvent =
  | ConnectedEvent
  | PingEvent
  | PongEvent
  | TaskStatusEvent
  | TaskFinalEvent
  | LogDroppedEvent
  | HeartbeatTimeoutEvent
  | LogMessage;

export interface FullLogResponse {
  content: string;
  source: "cache" | "database";
}

export interface AgentLogFileMeta {
  id: string;
  name: string;
  agent: string;
  size: number;
  modified_at: string;
}

export interface AgentLogFilesResponse {
  task_id: string;
  dapp_name: string;
  log_dir: string | null;
  files: AgentLogFileMeta[];
}

export interface AgentLogFileResponse extends AgentLogFileMeta {
  task_id: string;
  dapp_name: string;
  content: string;
  truncated: boolean;
}

export type ProductViewMode = "report" | "learn" | "auditor" | "raw";

export type ReportSectionKey =
  | "root_cause"
  | "attack_path"
  | "key_transactions"
  | "patch_suggestions"
  | "verification_results";

export interface EvidenceItem {
  id: string;
  title: string;
  source: "report" | "agent_log" | "tool" | "transaction" | "system";
  agent?: string;
  level?: LogLevel;
  message_type?: MsgType;
  timestamp?: string;
  log_id?: string;
  content: string;
  confidence: "high" | "medium" | "low";
}

export interface ProductModeConfig {
  mode: ProductViewMode;
  showRawLogs: boolean;
  showTeachingHints: boolean;
  showEvidenceByDefault: boolean;
}
