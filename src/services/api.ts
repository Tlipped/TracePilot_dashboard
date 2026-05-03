import axios from "axios";
import { FullLogResponse, Task, TaskCreateRequest } from "../types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
});

export async function listTasks(): Promise<Task[]> {
  const response = await api.get<Task[]>("/api/tasks");
  return response.data;
}

export async function getTask(taskId: string): Promise<Task> {
  const response = await api.get<Task>(`/api/tasks/${taskId}`);
  return response.data;
}

export async function createTask(payload: TaskCreateRequest): Promise<Task> {
  const response = await api.post<Task>("/api/tasks", payload);
  return response.data;
}

export async function cancelTask(taskId: string): Promise<void> {
  await api.delete(`/api/tasks/${taskId}`);
}

export async function getFullLog(taskId: string, logId: string): Promise<FullLogResponse> {
  const response = await api.get<FullLogResponse>(`/api/task/${taskId}/log/${logId}`);
  return response.data;
}
