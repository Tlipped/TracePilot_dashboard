import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, App as AntdApp, Button, Card, Descriptions, Empty, Space, Spin, Steps, Tag, Typography } from "antd";
import { CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { getTaskRecovery, resumeTask } from "../services/api";
import { CheckpointStageState, Task, TaskRecoveryState, TaskStatus } from "../types";

interface TaskRecoveryPanelProps {
  taskId: string;
  task: Task | null;
  onResumed: (task: Task) => void;
}

const STAGE_LABELS: Record<string, { title: string; description: string }> = {
  input_prepared: {
    title: "任务输入固化",
    description: "保存原始案例输入并绑定不可变指纹",
  },
  macro_analysis: {
    title: "宏观攻击分析",
    description: "交易筛选、攻击链识别与调试上下文",
  },
  micro_analysis: {
    title: "微观定位与报告",
    description: "根因定位、补丁分析与最终报告",
  },
};

const STATUS_LABELS: Record<string, string> = {
  not_started: "未开始",
  running: "执行中",
  completed: "已完成",
  failed: "失败",
  interrupted: "被中断",
};

function stepStatus(stage: CheckpointStageState): "wait" | "process" | "finish" | "error" {
  if (stage.latest_status === "running") return "process";
  if (stage.latest_status === "failed" || stage.latest_status === "interrupted") {
    return stage.valid_for_recovery ? "finish" : "error";
  }
  if (stage.valid_for_recovery) return "finish";
  return "wait";
}

function errorMessage(error: unknown) {
  const responseDetail = (
    error as { response?: { data?: { detail?: unknown } } }
  )?.response?.data?.detail;
  if (typeof responseDetail === "string") return responseDetail;
  return error instanceof Error ? error.message : "恢复请求失败，请稍后重试。";
}

const TaskRecoveryPanel: React.FC<TaskRecoveryPanelProps> = ({ taskId, task, onResumed }) => {
  const { message, modal } = AntdApp.useApp();
  const [state, setState] = useState<TaskRecoveryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadRecoveryState = useCallback(async (quiet = false) => {
    if (!taskId) return;
    if (!quiet) setLoading(true);
    try {
      const payload = await getTaskRecovery(taskId);
      setState(payload);
      setLoadError("");
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadRecoveryState();
    if (task?.status !== TaskStatus.RUNNING && task?.status !== TaskStatus.PENDING) return;
    const timer = window.setInterval(() => {
      void loadRecoveryState(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadRecoveryState, task?.status]);

  const resumeStageLabel = useMemo(() => {
    if (!state?.resume_from) return "无";
    if (state.resume_from === "finalization") return "完成状态提交";
    return STAGE_LABELS[state.resume_from]?.title ?? state.resume_from;
  }, [state?.resume_from]);

  const handleResume = () => {
    if (!state?.can_resume || resuming) return;
    modal.confirm({
      title: "从可信检查点继续任务？",
      content: (
        <div>
          系统将从“{resumeStageLabel}”继续。已完成阶段只有在输入指纹、隔离路径和产物
          SHA-256 均通过校验时才会跳过；后续 Agent 调用可能继续消耗时间与模型额度。
        </div>
      ),
      okText: "确认继续",
      cancelText: "取消",
      onOk: async () => {
        setResuming(true);
        try {
          const response = await resumeTask(taskId);
          setState(response.recovery);
          onResumed(response.task);
          message.success(`任务已恢复，将从“${resumeStageLabel}”继续`);
        } catch (error) {
          message.error(errorMessage(error));
          throw error;
        } finally {
          setResuming(false);
        }
      },
    });
  };

  if (loading && !state) {
    return (
      <Card className="task-recovery-card">
        <div className="checkpoint-loading">
          <Spin />
          <Typography.Text type="secondary">正在校验任务检查点…</Typography.Text>
        </div>
      </Card>
    );
  }

  if (loadError && !state) {
    return (
      <Card className="task-recovery-card">
        <Alert
          type="error"
          showIcon
          message="检查点状态暂时不可用"
          description={loadError}
          action={<Button onClick={() => void loadRecoveryState()}>重试</Button>}
        />
      </Card>
    );
  }

  if (!state) {
    return <Empty description="暂无检查点状态" />;
  }

  const alertType = state.reason_code === "OFFLINE_DEMO_SNAPSHOT"
    ? "info"
    : task?.status === TaskStatus.COMPLETED
      ? "success"
      : state.can_resume
        ? "warning"
        : task?.status === TaskStatus.FAILED
          ? "error"
          : "info";

  return (
    <div className="task-recovery-panel">
      <Card
        className="task-recovery-card"
        title={(
          <Space>
            <ShieldCheck size={18} />
            <span>阶段 Checkpoint 与恢复</span>
          </Space>
        )}
        extra={(
          <Space>
            <Tag>{state.checkpoint_count} 条事件</Tag>
            <Tag color={state.recovery_count > 0 ? "blue" : "default"}>
              已恢复 {state.recovery_count} 次
            </Tag>
          </Space>
        )}
      >
        <Alert
          type={alertType}
          showIcon
          message={state.can_resume ? `可从“${resumeStageLabel}”继续` : state.reason}
          description={state.can_resume ? state.reason : undefined}
          action={state.can_resume ? (
            <Button
              type="primary"
              icon={<RotateCcw size={15} />}
              loading={resuming}
              onClick={handleResume}
            >
              从检查点继续
            </Button>
          ) : undefined}
        />

        <Steps
          className="checkpoint-steps"
          direction="vertical"
          items={state.stages.map((stage) => {
            const metadata = STAGE_LABELS[stage.stage] ?? {
              title: stage.stage,
              description: "工作流阶段",
            };
            const checksum = stage.artifact_sha256
              ? `${stage.artifact_sha256.slice(0, 12)}…`
              : null;
            return {
              title: (
                <Space wrap>
                  <Typography.Text strong>{metadata.title}</Typography.Text>
                  <Tag color={stage.valid_for_recovery ? "success" : undefined}>
                    {STATUS_LABELS[stage.latest_status] ?? stage.latest_status}
                  </Tag>
                  {stage.valid_for_recovery ? (
                    <Tag icon={<CheckCircle2 size={12} />} color="success">可复用</Tag>
                  ) : null}
                </Space>
              ),
              status: stepStatus(stage),
              description: (
                <div className="checkpoint-stage-detail">
                  <Typography.Text type="secondary">{metadata.description}</Typography.Text>
                  <Typography.Text type="secondary">{stage.validation_message}</Typography.Text>
                  <Space size={12} wrap>
                    <span>尝试 #{stage.latest_attempt || 0}</span>
                    {stage.artifact_size != null ? <span>产物 {stage.artifact_size.toLocaleString()} B</span> : null}
                    {checksum ? <span className="text-mono">SHA-256 {checksum}</span> : null}
                  </Space>
                </div>
              ),
            };
          })}
        />

        <Descriptions className="checkpoint-trust-boundary" size="small" column={2}>
          <Descriptions.Item label="输入指纹">
            <Typography.Text className="text-mono" copyable={Boolean(state.input_sha256)}>
              {state.input_sha256 ? `${state.input_sha256.slice(0, 16)}…` : "未建立"}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="恢复原则">
            只跳过校验通过的阶段
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default TaskRecoveryPanel;
