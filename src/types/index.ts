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
  persisted_id?: number;
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

export interface TaskLogPageResponse {
  events: LogMessage[];
  next_before_id?: number | null;
  has_more: boolean;
  total: number;
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

export type LanguageMode = "en" | "zh";

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
  full_content?: string;
  confidence: "high" | "medium" | "low";
}

export interface ProductModeConfig {
  mode: ProductViewMode;
  showRawLogs: boolean;
  showTeachingHints: boolean;
  showEvidenceByDefault: boolean;
}

export interface AddressRole {
  role?: string;
  description?: string;
}

export interface TransactionRoleEvidence extends AddressRole {
  address: string;
}

export interface TokenBalanceChange {
  token?: string;
  name?: string;
  amount?: number | string | null;
  usd_value?: number | null;
  contract?: string | null;
}

export interface BalanceParticipantSummary {
  address: string;
  usd_delta: number;
  tokens: TokenBalanceChange[];
}

export interface TransactionBalanceSummary {
  participant_count: number;
  total_usd_delta: number;
  top_participants: BalanceParticipantSummary[];
}

export interface MacroTransactionSummary {
  hash: string;
  display_hash: string;
  type: "attack" | "auxiliary" | "candidate";
  is_debug_target: boolean;
  order: number;
  from?: string | null;
  to?: string | null;
  from_role?: string | null;
  to_role?: string | null;
  involved_roles: TransactionRoleEvidence[];
  block_number?: number | null;
  timestamp?: number | null;
  function_signature?: string | null;
  status?: string | null;
  success?: boolean | null;
  value_eth?: number | null;
  gas_used?: number | null;
  cost_eth?: number | null;
  interacted_addresses: string[];
  event_logs: string[];
  balance_summary: TransactionBalanceSummary;
}

export interface MacroAnalysisResponse {
  task_id: string;
  dapp_name: string;
  processed_file: string;
  dapp?: Record<string, unknown>;
  transaction_hash_list: string[];
  transaction_roles: Record<string, AddressRole>;
  attack_transactions: string[];
  auxiliary_transactions: string[];
  transactions_need_analyze: string[];
  bug_summary: string;
  time_used: Record<string, unknown>;
  token_used: Record<string, unknown>;
  transactions: MacroTransactionSummary[];
  balance_change: Record<string, unknown>;
  transaction_to_property: Record<string, unknown>;
}
