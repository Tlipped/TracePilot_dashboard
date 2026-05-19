import axios from "axios";
import { BACKEND_HTTP_URL } from "../config/appConfig";
import {
  AgentLogFileResponse,
  AgentLogFilesResponse,
  AutomatedReviewResponse,
  DappCatalogResponse,
  FullLogResponse,
  MacroAnalysisResponse,
  Task,
  TaskCreateRequest,
  TaskLogPageResponse,
} from "../types";

export const api = axios.create({
  baseURL: BACKEND_HTTP_URL,
});

export async function listTasks(includeArchived = false): Promise<Task[]> {
  const response = await api.get<Task[]>("/api/tasks", {
    params: includeArchived ? { include_archived: true } : undefined,
  });
  return response.data;
}

export async function listDapps(): Promise<DappCatalogResponse> {
  const response = await api.get<DappCatalogResponse>("/api/dapps");
  return response.data;
}

export async function getTask(taskId: string): Promise<Task> {
  const response = await api.get<Task>(`/api/tasks/${taskId}`);
  return response.data;
}

export async function getMacroAnalysis(taskId: string): Promise<MacroAnalysisResponse> {
  const response = await api.get<MacroAnalysisResponse>(`/api/tasks/${taskId}/macro-analysis`);
  return response.data;
}

export async function getAutomatedReview(taskId: string): Promise<AutomatedReviewResponse> {
  const response = await api.get<AutomatedReviewResponse>(`/api/tasks/${taskId}/automated-review`);
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
  const response = await api.get<FullLogResponse>(`/api/task/${taskId}/log/${logId}`);
  return response.data;
}

export async function getTaskLogs(
  taskId: string,
  params: { limit?: number; before_id?: number | null } = {},
): Promise<TaskLogPageResponse> {
  const response = await api.get<TaskLogPageResponse>(`/api/tasks/${taskId}/logs`, { params });
  return response.data;
}

export async function listAgentLogFiles(taskId: string): Promise<AgentLogFilesResponse> {
  const response = await api.get<AgentLogFilesResponse>(`/api/tasks/${taskId}/agent-log-files`);
  return response.data;
}

export async function getAgentLogFile(
  taskId: string,
  fileId: string,
  maxBytes = 2_000_000,
): Promise<AgentLogFileResponse> {
  const response = await api.get<AgentLogFileResponse>(`/api/tasks/${taskId}/agent-log-files/${fileId}`, {
    params: { max_bytes: maxBytes },
  });
  return response.data;
}
