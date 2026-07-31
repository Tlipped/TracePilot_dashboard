import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Progress, Space, Tag, Tooltip, Typography } from "antd";
import { Activity, Clock3, ShieldCheck } from "lucide-react";
import { getTaskProgress } from "../services/api";
import { Task, TaskProgressState, TaskStatus } from "../types";
import { agentDisplayName } from "../utils/presentation";

interface TaskProgressMonitorProps {
  taskId: string;
  task: Task | null;
}

const HEALTH_META: Record<string, { label: string; color: string; tone: "success" | "info" | "warning" | "error" }> = {
  queued: { label: "等待调度", color: "default", tone: "info" },
  healthy: { label: "进展正常", color: "success", tone: "success" },
  waiting_external: { label: "等待外部响应", color: "processing", tone: "info" },
  slow_progress: { label: "进展偏慢", color: "warning", tone: "warning" },
  stalled: { label: "可能停滞", color: "warning", tone: "warning" },
  terminated: { label: "护栏终止", color: "error", tone: "error" },
  failed: { label: "执行失败", color: "error", tone: "error" },
  cancelled: { label: "已取消", color: "default", tone: "info" },
  completed: { label: "已完成", color: "success", tone: "success" },
};

function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value < 1) return "刚刚";
  if (value < 60) return `${Math.floor(value)} 秒`;
  if (value < 3600) return `${Math.floor(value / 60)} 分 ${Math.floor(value % 60)} 秒`;
  return `${Math.floor(value / 3600)} 小时 ${Math.floor((value % 3600) / 60)} 分`;
}

function errorMessage(error: unknown) {
  const responseDetail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;
  if (typeof responseDetail === "string") return responseDetail;
  return error instanceof Error ? error.message : "进度状态暂时不可用。";
}

const TaskProgressMonitor: React.FC<TaskProgressMonitorProps> = ({ taskId, task }) => {
  const [state, setState] = useState<TaskProgressState | null>(null);
  const [loadError, setLoadError] = useState("");

  const loadProgress = useCallback(async () => {
    if (!taskId) return;
    try {
      setState(await getTaskProgress(taskId));
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [taskId]);

  useEffect(() => {
    void loadProgress();
    if (task?.status !== TaskStatus.PENDING && task?.status !== TaskStatus.RUNNING) return;
    const timer = window.setInterval(() => {
      void loadProgress();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [loadProgress, task?.status]);

  const recentMilestones = useMemo(
    () => (state?.events ?? [])
      .filter((event) => event.kind === "milestone")
      .slice(-3)
      .reverse(),
    [state?.events],
  );

  if (!state && loadError) {
    return (
      <Alert
        className="task-progress-monitor-error"
        type="warning"
        showIcon
        message="暂时无法读取进度感知状态"
        description={loadError}
        action={<Button size="small" onClick={() => void loadProgress()}>重试</Button>}
      />
    );
  }

  if (!state) {
    return (
      <section className="task-progress-monitor is-loading" aria-busy="true">
        <Activity size={16} />
        <Typography.Text type="secondary">正在建立进度感知…</Typography.Text>
      </section>
    );
  }

  const health = HEALTH_META[state.health] ?? {
    label: state.health,
    color: "default",
    tone: "info" as const,
  };
  const progressStatus = state.health === "terminated" || state.health === "failed"
    ? "exception"
    : state.health === "completed"
      ? "success"
      : "active";
  const showHealthAlert = ["waiting_external", "slow_progress", "stalled", "terminated"].includes(state.health);
  const healthDescription = state.health === "waiting_external"
    ? "当前没有新的运行活动，通常表示正在等待基座模型、RPC 或外部工具；达到无活动终止阈值前不会自动杀掉任务。"
    : state.health === "slow_progress"
      ? "仍能收到运行活动，但较久没有跨越新的可信节点。普通日志不会推动进度条。"
      : state.health === "stalled"
        ? "日志可能仍在产生，但有效阶段长期未推进。Watchdog 会继续观察，不会仅凭模型较慢自动终止。"
        : state.termination_reason ?? "Watchdog 已根据硬超时或完全无活动超时终止任务。";

  return (
    <section className={`task-progress-monitor health-${state.health}`} aria-live="polite">
      <div className="task-progress-main">
        <div className="task-progress-heading">
          <Space size={8} wrap>
            <ShieldCheck size={17} />
            <Typography.Text strong>任务进度</Typography.Text>
            <Tag color={health.color}>{health.label}</Tag>
            <Tooltip title={state.eta_reason}>
              <Tag>里程碑覆盖率 · 非时间预测</Tag>
            </Tooltip>
          </Space>
          <Typography.Text type="secondary">
            已运行 {formatSeconds(state.elapsed_seconds)}
          </Typography.Text>
        </div>

        <Progress
          percent={Math.max(0, Math.min(state.percent, 100))}
          status={progressStatus}
          strokeColor={state.health === "stalled" || state.health === "slow_progress" ? "#f59e0b" : undefined}
          format={(percent) => `${percent}% 节点`}
        />

        <div className="task-progress-facts">
          <div>
            <span>当前节点</span>
            <strong>{state.label}</strong>
          </div>
          <div>
            <span>最近运行活动</span>
            <strong>{formatSeconds(state.activity_idle_seconds)}前</strong>
          </div>
          <div>
            <span>最近有效进展</span>
            <strong>{formatSeconds(state.progress_idle_seconds)}前</strong>
          </div>
          <div>
            <span>当前智能体</span>
            <strong>{state.active_agent ? agentDisplayName(state.active_agent) : "系统控制面"}</strong>
          </div>
        </div>

        {recentMilestones.length > 0 ? (
          <div className="task-progress-milestones">
            <Clock3 size={13} />
            {recentMilestones.map((event) => (
              <span key={event.event_id}>{event.label}</span>
            ))}
          </div>
        ) : null}
      </div>

      {showHealthAlert ? (
        <Alert
          type={health.tone}
          showIcon
          message={health.label}
          description={healthDescription}
        />
      ) : null}
    </section>
  );
};

export default TaskProgressMonitor;
