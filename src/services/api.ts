import axios from "axios";
import { BACKEND_HTTP_URL } from "../config/appConfig";
import {
  getDemoAutomatedReview,
  getDemoCaseReview,
  getDemoFullLog,
  getDemoMacroAnalysis,
  getDemoTask,
  getDemoTaskLogs,
  getDemoAgentLogFile,
  getDemoAgentLogFiles,
  hasDemoSnapshot,
  listDemoTasks,
} from "../utils/demoSnapshots";
import {
  AgentLogFileResponse,
  AgentLogFilesResponse,
  AssistantChatRequest,
  AssistantChatResponse,
  AutomatedReviewResponse,
  CaseReviewV1,
  DappCatalogResponse,
  FullLogResponse,
  ExecutionEvent,
  MacroAnalysisResponse,
  RagSearchRequest,
  RagSearchResponse,
  Task,
  TaskCreateRequest,
  TaskRecoveryState,
  TaskResumeResponse,
  TaskProgressState,
  TxDetectRequest,
  TxDetectResponse,
  TaskLogPageResponse,
  TaskExecutionEventPage,
  TxReviewRequest,
  TxReviewResponse,
  VulnerabilityKnowledgeResponse,
} from "../types";

export const api = axios.create({
  baseURL: BACKEND_HTTP_URL,
});

export async function listTasks(includeArchived = false): Promise<Task[]> {
  try {
    const response = await api.get<Task[]>("/api/tasks", {
      params: includeArchived ? { include_archived: true } : undefined,
    });
    const remoteIds = new Set(response.data.map((task) => task.task_id));
    const offlineDemos = listDemoTasks().filter((task) => !remoteIds.has(task.task_id));
    return [...response.data, ...offlineDemos];
  } catch {
    return listDemoTasks();
  }
}

export async function listDapps(): Promise<DappCatalogResponse> {
  const response = await api.get<DappCatalogResponse>("/api/dapps");
  return response.data;
}


export async function listVulnerabilityKnowledge(): Promise<VulnerabilityKnowledgeResponse> {
  const response = await api.get<VulnerabilityKnowledgeResponse>("/api/knowledge/vulnerabilities");
  return response.data;
}

export async function reviewTransaction(payload: TxReviewRequest): Promise<TxReviewResponse> {
  const response = await api.post<TxReviewResponse>("/api/tx-review", payload);
  return response.data;
}

export async function detectTransactions(payload: TxDetectRequest): Promise<TxDetectResponse> {
  const response = await api.post<TxDetectResponse>("/api/tx-detect", payload);
  return response.data;
}

export async function startTransactionDeepAnalysis(payload: TxReviewRequest): Promise<Task> {
  const response = await api.post<Task>("/api/tx-review/deep-analysis", payload);
  return response.data;
}

export async function chatWithAssistant(payload: AssistantChatRequest): Promise<AssistantChatResponse> {
  const response = await api.post<AssistantChatResponse>("/api/assistant/chat", payload);
  return response.data;
}

export async function searchRagKnowledge(payload: RagSearchRequest): Promise<RagSearchResponse> {
  const response = await api.post<RagSearchResponse>("/api/rag/search", payload);
  return response.data;
}

export async function getTask(taskId: string): Promise<Task> {
  const demoTask = getDemoTask(taskId);
  if (demoTask) return demoTask;
  const response = await api.get<Task>(`/api/tasks/${taskId}`);
  return response.data;
}

export async function getTaskRecovery(taskId: string): Promise<TaskRecoveryState> {
  const demoTask = getDemoTask(taskId);
  if (demoTask) {
    return {
      task_id: taskId,
      task_status: demoTask.status,
      can_resume: false,
      resume_from: null,
      reason_code: "OFFLINE_DEMO_SNAPSHOT",
      reason: "离线演示快照是只读结果，不会触发真实 Agent 续跑。",
      input_sha256: null,
      checkpoint_count: 0,
      recovery_count: 0,
      stages: [],
      events: [],
    };
  }
  const response = await api.get<TaskRecoveryState>(`/api/tasks/${taskId}/recovery`);
  return response.data;
}

export async function getTaskProgress(taskId: string): Promise<TaskProgressState> {
  const demoTask = getDemoTask(taskId);
  if (demoTask) {
    const completed = demoTask.status === "completed";
    return {
      task_id: taskId,
      task_status: demoTask.status,
      live: false,
      health: completed ? "completed" : demoTask.status,
      percent: completed ? 100 : 0,
      percent_basis: "offline_snapshot_state",
      eta_available: false,
      eta_reason: "离线演示快照是固定结果，不包含实时运行时间预测。",
      stage: completed ? "snapshot_ready" : "offline_snapshot",
      step_key: completed ? "snapshot_completed" : "snapshot_unavailable",
      label: completed ? "离线演示快照已就绪" : "离线演示快照",
      started_at: demoTask.created_at,
      last_activity_at: demoTask.completed_at,
      last_progress_at: demoTask.completed_at,
      elapsed_seconds: demoTask.duration ?? 0,
      activity_idle_seconds: 0,
      progress_idle_seconds: 0,
      active_agent: null,
      termination_reason: null,
      watchdog_policy: {
        activity_warning_seconds: 300,
        progress_warning_seconds: 600,
        stalled_seconds: 1200,
        abort_no_activity_seconds: 2700,
        hard_timeout_seconds: 10800,
        check_interval_seconds: 5,
      },
      events: [],
    };
  }
  const response = await api.get<TaskProgressState>(`/api/tasks/${taskId}/progress`);
  return response.data;
}

export async function resumeTask(taskId: string): Promise<TaskResumeResponse> {
  if (hasDemoSnapshot(taskId)) {
    throw new Error("离线演示快照不可恢复，请选择真实运行任务。");
  }
  const response = await api.post<TaskResumeResponse>(`/api/tasks/${taskId}/resume`);
  return response.data;
}

export async function getMacroAnalysis(taskId: string): Promise<MacroAnalysisResponse> {
  const demoMacro = getDemoMacroAnalysis(taskId);
  if (demoMacro) return demoMacro;
  if (hasDemoSnapshot(taskId)) throw new Error("Offline demo macro analysis is not available.");
  const response = await api.get<MacroAnalysisResponse>(`/api/tasks/${taskId}/macro-analysis`);
  return response.data;
}

export async function getAutomatedReview(taskId: string): Promise<AutomatedReviewResponse> {
  const demoReview = getDemoAutomatedReview(taskId);
  if (demoReview) return demoReview;
  if (hasDemoSnapshot(taskId)) throw new Error("Offline demo automated review is not available.");
  const response = await api.get<AutomatedReviewResponse>(`/api/tasks/${taskId}/automated-review`);
  return response.data;
}

export async function getCaseReview(taskId: string): Promise<CaseReviewV1> {
  const demoReview = getDemoCaseReview(taskId);
  if (demoReview) return demoReview;
  if (hasDemoSnapshot(taskId)) {
    throw new Error("Offline demo trusted review is not available.");
  }
  const response = await api.get<CaseReviewV1>(`/api/tasks/${taskId}/case-review`);
  return response.data;
}

export async function createTask(payload: TaskCreateRequest): Promise<Task> {
  const response = await api.post<Task>("/api/tasks", payload);
  return response.data;
}

export async function cancelTask(taskId: string): Promise<void> {
  await api.post(`/api/tasks/${taskId}/cancel`);
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/api/tasks/${taskId}`);
}

export async function archiveTask(taskId: string): Promise<void> {
  await api.post(`/api/tasks/${taskId}/archive`);
}

export async function unarchiveTask(taskId: string): Promise<void> {
  await api.post(`/api/tasks/${taskId}/unarchive`);
}

export async function getFullLog(taskId: string, logId: string): Promise<FullLogResponse> {
  const demoLog = await getDemoFullLog(taskId, logId);
  if (demoLog) return { content: demoLog, source: "cache" };
  const response = await api.get<FullLogResponse>(`/api/task/${taskId}/log/${logId}`);
  return response.data;
}

export async function getTaskLogs(
  taskId: string,
  params: { limit?: number; before_id?: number | null } = {},
): Promise<TaskLogPageResponse> {
  const demoLogs = getDemoTaskLogs(taskId, params);
  if (demoLogs) return demoLogs;
  const response = await api.get<TaskLogPageResponse>(`/api/tasks/${taskId}/logs`, { params });
  return response.data;
}

export async function getTaskExecutionEvents(
  taskId: string,
  params: { limit?: number; before_id?: number | null; include_payloads?: boolean } = {},
): Promise<TaskExecutionEventPage> {
  const response = await api.get<TaskExecutionEventPage>(`/api/tasks/${taskId}/execution-events`, { params });
  return response.data;
}

export async function getTaskExecutionEvent(taskId: string, eventId: string): Promise<ExecutionEvent> {
  const response = await api.get<ExecutionEvent>(`/api/tasks/${taskId}/execution-events/${eventId}`);
  return response.data;
}

export async function listAgentLogFiles(taskId: string): Promise<AgentLogFilesResponse> {
  const demoFiles = await getDemoAgentLogFiles(taskId);
  if (demoFiles) return demoFiles;
  const response = await api.get<AgentLogFilesResponse>(`/api/tasks/${taskId}/agent-log-files`);
  return response.data;
}

export async function getAgentLogFile(
  taskId: string,
  fileId: string,
  maxBytes = 2_000_000,
): Promise<AgentLogFileResponse> {
  const demoFile = await getDemoAgentLogFile(taskId, fileId);
  if (demoFile) return demoFile;
  const response = await api.get<AgentLogFileResponse>(`/api/tasks/${taskId}/agent-log-files/${fileId}`, {
    params: { max_bytes: maxBytes },
  });
  return response.data;
}
