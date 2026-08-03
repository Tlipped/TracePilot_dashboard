import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  Bot,
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Copy,
  Database,
  Flag,
  Hash,
  Layers3,
  Network,
  RefreshCcw,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { getTaskExecutionEvent, getTaskExecutionEvents } from "../services/api";
import { ExecutionEvent, TaskStatus } from "../types";
import { agentDisplayName } from "../utils/presentation";

interface ExecutionChainPanelProps {
  taskId: string;
  taskStatus?: TaskStatus;
  selectedAgent: string | "all";
}

type JsonRecord = Record<string, unknown>;

const PAGE_SIZE = 200;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function formatTime(value?: string | null) {
  if (!value) return "--:--:--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatBytes(value?: number | null) {
  if (value === null || value === undefined) return "—";
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}

function phaseLabel(phase: string) {
  const labels: Record<string, string> = {
    orchestration: "任务编排",
    input_prepared: "案件接入",
    task_planning: "任务规划",
    macro_analysis: "宏观分析",
    micro_analysis: "Trace 调试",
    trace_debugging: "Trace 调试",
    patch_generation: "补丁生成",
    patch_verification: "补丁验证",
    report_generation: "报告生成",
  };
  return labels[phase] ?? phase.replace(/_/g, " ");
}

function eventKindLabel(event: ExecutionEvent) {
  if (event.event_type === "workflow.run") return "任务执行";
  if (event.event_type === "workflow.stage") return "阶段产物";
  if (event.event_type === "agent.handoff") return "Agent 交接";
  if (event.event_type === "llm.turn") return "模型决策";
  if (event.event_type === "tool.call") return "工具调用";
  return event.event_type;
}

function eventIcon(event: ExecutionEvent) {
  if (event.status === "failed" || event.status === "cancelled") return <XCircle size={16} />;
  if (event.status === "running") return <CircleDot size={16} />;
  if (event.event_type === "tool.call") return <Wrench size={16} />;
  if (event.event_type === "agent.handoff") return <Network size={16} />;
  if (event.event_type === "workflow.stage") return <Layers3 size={16} />;
  if (event.event_type === "workflow.run") return <Flag size={16} />;
  if (event.event_type === "llm.turn") return <Bot size={16} />;
  return <CheckCircle2 size={16} />;
}

function statusTag(status: string) {
  if (status === "completed") return <Tag color="success">已完成</Tag>;
  if (status === "running") return <Tag color="processing">执行中</Tag>;
  if (status === "failed") return <Tag color="error">失败</Tag>;
  if (status === "cancelled") return <Tag>已取消</Tag>;
  return <Tag>{status}</Tag>;
}

function eventPreview(event: ExecutionEvent) {
  const conclusion = displayMetadata(event, "conclusion");
  const reason = displayMetadata(event, "reason");
  const nextAction = displayMetadata(event, "next_action");
  if (event.event_type === "agent.handoff") {
    return [reason, nextAction ? `下一步：${nextAction}` : ""].filter(Boolean).join(" ");
  }
  if (event.event_type === "workflow.stage" && conclusion) return conclusion;
  if (event.event_type === "workflow.run") {
    if (event.status === "running") return "多智能体正在协作分析该案件。";
    if (event.status === "completed") return "多智能体分析已完成，阶段产物和交接关系可继续下钻。";
    return "任务没有正常完成，请查看失败阶段与错误详情。";
  }
  const output = event.output_preview?.trim();
  const input = event.input_preview?.trim();
  if (output) return output;
  if (event.status === "running") return "正在等待执行结果…";
  return input || "本步骤未产生可预览内容。";
}

function displayMetadata(event: ExecutionEvent, key: string) {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function eventTitle(event: ExecutionEvent) {
  if (event.event_type === "agent.handoff") {
    const fromAgent = displayMetadata(event, "from_agent") || event.agent;
    const toAgent = displayMetadata(event, "to_agent") || "下一智能体";
    return `${agentDisplayName(fromAgent)} → ${agentDisplayName(toAgent)}`;
  }
  if (event.event_type === "workflow.stage") {
    return displayMetadata(event, "stage_label") || event.operation;
  }
  if (event.event_type === "workflow.run") return "案件分析工作流";
  return event.operation;
}

function WorkflowEventView({ event }: { event: ExecutionEvent }) {
  if (!event.event_type.startsWith("workflow.") && event.event_type !== "agent.handoff") return null;

  const input = asRecord(event.input) ?? {};
  const output = asRecord(event.output) ?? {};
  const artifacts = asArray(event.event_type === "agent.handoff" ? input.artifacts : output.artifacts);
  const fromAgent = displayMetadata(event, "from_agent") || event.agent;
  const toAgent = displayMetadata(event, "to_agent");
  const reason = displayValue(input.reason ?? event.metadata.reason);
  const runConclusion = event.status === "running"
    ? "多智能体工作流正在执行。"
    : output.error || (output.final_report_ready === true ? "工作流已形成最终报告。" : "工作流已结束。");
  const conclusion = displayValue(output.conclusion ?? event.metadata.conclusion ?? runConclusion);
  const nextAction = displayValue(output.next_action ?? event.metadata.next_action);

  return (
    <div className="workflow-event-detail">
      {event.event_type === "agent.handoff" ? (
        <div className="workflow-handoff-route">
          <div><span>交接方</span><strong>{agentDisplayName(fromAgent)}</strong></div>
          <Network size={18} />
          <div><span>接收方</span><strong>{agentDisplayName(toAgent)}</strong></div>
        </div>
      ) : null}
      <div className="workflow-summary-grid">
        {event.event_type === "agent.handoff" ? (
          <div><span>为什么交接</span><p>{reason}</p></div>
        ) : null}
        <div><span>{event.event_type === "agent.handoff" ? "交付结论" : "阶段结论"}</span><p>{conclusion}</p></div>
        {event.event_type === "agent.handoff" ? (
          <div><span>下一步</span><p>{nextAction}</p></div>
        ) : null}
      </div>
      {artifacts.length > 0 ? (
        <div className="execution-detail-section">
          <Typography.Text strong>交付产物</Typography.Text>
          <div className="execution-event-chips">
            {artifacts.map((artifact, index) => {
              const item = asRecord(artifact) ?? {};
              return <Tag key={index}>{displayValue(item.type)}{item.reference ? ` · ${displayValue(item.reference)}` : ""}</Tag>;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VariableList({ title, values }: { title: string; values: unknown[] }) {
  if (values.length === 0) return null;
  return (
    <div className="execution-detail-section">
      <Typography.Text strong>{title}</Typography.Text>
      <div className="execution-variable-list">
        {values.map((item, index) => {
          const variable = asRecord(item) ?? {};
          return (
            <div className="execution-variable" key={`${displayValue(variable.name)}-${index}`}>
              <span className="text-mono">{displayValue(variable.type)}</span>
              <strong>{displayValue(variable.name)}</strong>
              <code>{displayValue(variable.value)}</code>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NodeStateView({ output }: { output: JsonRecord }) {
  const node = asRecord(output.node);
  if (output.tool !== "get_node_detailed_state" || !node) return null;

  const contract = asRecord(node.logic_contract) ?? {};
  const storage = asArray(node.storage_operations);
  const changedStorage = storage.filter((item) => asRecord(item)?.changed === true);
  const emittedEvents = asArray(node.events);

  return (
    <div className="execution-node-state">
      <div className="execution-node-summary">
        <div>
          <span>调用节点</span>
          <strong>#{displayValue(node.index)}</strong>
        </div>
        <div>
          <span>函数</span>
          <strong>{displayValue(node.function)}</strong>
        </div>
        <div>
          <span>逻辑合约</span>
          <strong>{displayValue(contract.name)}</strong>
        </div>
        <div>
          <span>状态写入</span>
          <strong>{changedStorage.length} / {storage.length}</strong>
        </div>
      </div>

      <Descriptions size="small" column={1} bordered>
        <Descriptions.Item label="交易哈希">
          <Typography.Text copyable className="text-mono">{displayValue(output.transaction_hash)}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="合约地址">
          <Typography.Text copyable className="text-mono">{displayValue(contract.address)}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="存储上下文">
          <Typography.Text copyable className="text-mono">{displayValue(node.storage_context)}</Typography.Text>
        </Descriptions.Item>
        <Descriptions.Item label="调用类型">
          {displayValue(node.call_type)}{node.is_proxy_call === true ? <Tag color="blue">代理调用</Tag> : null}
        </Descriptions.Item>
      </Descriptions>

      <VariableList title="解码输入" values={asArray(node.decoded_input)} />
      <VariableList title="解码输出" values={asArray(node.decoded_output)} />
      <VariableList title="调用方变量" values={asArray(node.caller_variables)} />
      <VariableList title="函数变量" values={asArray(node.function_variables)} />

      <div className="execution-detail-section">
        <Space size={8}>
          <Database size={15} />
          <Typography.Text strong>存储访问</Typography.Text>
          <Tag>{storage.length} 条</Tag>
        </Space>
        {storage.length === 0 ? (
          <Typography.Text type="secondary">该节点没有直接存储访问。</Typography.Text>
        ) : (
          <div className="execution-storage-list">
            {storage.map((item, index) => {
              const operation = asRecord(item) ?? {};
              return (
                <div className={`execution-storage-row${operation.changed === true ? " changed" : ""}`} key={index}>
                  <div>
                    <Tag color={operation.changed === true ? "gold" : undefined}>{displayValue(operation.operation)}</Tag>
                    <Typography.Text className="text-mono">slot {displayValue(operation.slot)}</Typography.Text>
                  </div>
                  <code>{displayValue(operation.value_before)}</code>
                  <span>→</span>
                  <code>{displayValue(operation.value_after)}</code>
                  {operation.source_line ? <small>源码行 {displayValue(operation.source_line)}</small> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {emittedEvents.length > 0 ? (
        <div className="execution-detail-section">
          <Typography.Text strong>触发事件</Typography.Text>
          <div className="execution-event-chips">
            {emittedEvents.map((item, index) => {
              const emitted = asRecord(item) ?? {};
              return <Tag key={index}>{displayValue(emitted.name)}</Tag>;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function JsonPayload({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="execution-json-block">
      <Typography.Text strong>{title}</Typography.Text>
      {value === null || value === undefined ? (
        <Typography.Text type="secondary">未记录</Typography.Text>
      ) : (
        <pre>{displayValue(value)}</pre>
      )}
    </div>
  );
}

const ExecutionChainPanel: React.FC<ExecutionChainPanelProps> = ({ taskId, taskStatus, selectedAgent }) => {
  const { message } = AntdApp.useApp();
  const [events, setEvents] = useState<ExecutionEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [error, setError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<ExecutionEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [displayScope, setDisplayScope] = useState<"workflow" | "chain" | "all">("workflow");

  const loadLatest = useCallback(async (silent = false) => {
    if (!taskId) return;
    if (!silent) setLoading(true);
    try {
      const page = await getTaskExecutionEvents(taskId, { limit: PAGE_SIZE });
      setEvents(page.events);
      setTotal(page.total);
      setHasMore(page.has_more);
      setNextBeforeId(page.next_before_id ?? null);
      setError("");
    } catch {
      setError("结构化执行事件暂时无法读取，请确认后端已更新并正常运行。");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  useEffect(() => {
    if (taskStatus !== TaskStatus.RUNNING) return;
    const timer = window.setInterval(() => void loadLatest(true), 4000);
    return () => window.clearInterval(timer);
  }, [loadLatest, taskStatus]);

  const loadEarlier = async () => {
    if (!nextBeforeId || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const page = await getTaskExecutionEvents(taskId, { limit: PAGE_SIZE, before_id: nextBeforeId });
      setEvents((current) => {
        const known = new Set(current.map((item) => item.event_id));
        return [...page.events.filter((item) => !known.has(item.event_id)), ...current];
      });
      setHasMore(page.has_more);
      setNextBeforeId(page.next_before_id ?? null);
    } catch {
      message.warning("更早的执行事件暂时无法读取。");
    } finally {
      setLoadingEarlier(false);
    }
  };

  const openDetail = (event: ExecutionEvent) => {
    setSelectedEvent(event);
    setDrawerOpen(true);
    setDetailLoading(true);
    getTaskExecutionEvent(taskId, event.event_id)
      .then((detail) => setSelectedEvent(detail))
      .catch(() => message.warning("完整调用载荷暂时不可用，当前展示事件摘要。"))
      .finally(() => setDetailLoading(false));
  };

  const filteredEvents = useMemo(
    () => events.filter((event) => selectedAgent === "all" || event.agent === selectedAgent),
    [events, selectedAgent],
  );

  const visibleEvents = useMemo(() => {
    if (displayScope === "all") return filteredEvents;
    if (displayScope === "workflow") {
      return filteredEvents.filter((event) => ["workflow.run", "workflow.stage", "agent.handoff"].includes(event.event_type));
    }
    const toolParentIds = new Set(
      filteredEvents
        .filter((event) => event.event_type === "tool.call")
        .map((event) => event.parent_event_id)
        .filter((eventId): eventId is string => Boolean(eventId)),
    );
    return filteredEvents.filter((event) => (
      event.event_type === "tool.call"
      || toolParentIds.has(event.event_id)
      || ["failed", "cancelled"].includes(event.status)
    ));
  }, [displayScope, filteredEvents]);

  const eventDepth = useMemo(() => {
    const byId = new Map(events.map((event) => [event.event_id, event]));
    const depths = new Map<string, number>();
    const resolve = (event: ExecutionEvent, visited = new Set<string>()): number => {
      if (!event.parent_event_id || visited.has(event.event_id)) return 0;
      const cached = depths.get(event.event_id);
      if (cached !== undefined) return cached;
      const parent = byId.get(event.parent_event_id);
      if (!parent) return 0;
      visited.add(event.event_id);
      const depth = Math.min(2, resolve(parent, visited) + 1);
      depths.set(event.event_id, depth);
      return depth;
    };
    events.forEach((event) => depths.set(event.event_id, resolve(event)));
    return depths;
  }, [events]);

  const agentCount = new Set(filteredEvents.map((event) => event.agent)).size;
  const stageCount = filteredEvents.filter((event) => event.event_type === "workflow.stage").length;
  const handoffCount = filteredEvents.filter((event) => event.event_type === "agent.handoff").length;
  const toolCount = filteredEvents.filter((event) => event.event_type === "tool.call").length;
  const failedCount = filteredEvents.filter((event) => ["failed", "cancelled"].includes(event.status)).length;
  const detailOutput = asRecord(selectedEvent?.output);

  return (
    <>
      <section className="execution-chain-panel">
        <div className="panel-header execution-chain-header">
          <div>
            <Space size={8}>
              <Network size={16} />
              <Typography.Text strong>智能体执行链</Typography.Text>
              <Tag color="blue">结构化事件</Tag>
            </Space>
            <Typography.Paragraph type="secondary">
              先看多智能体如何分工和交接，再按需下钻工具调用；大模型原文仍保留在原始日志中。
            </Typography.Paragraph>
          </div>
          <Space size={8} wrap>
            <Segmented
              size="small"
              value={displayScope}
              onChange={(value) => setDisplayScope(value as "workflow" | "chain" | "all")}
              options={[
                { label: "主流程", value: "workflow" },
                { label: "工具调用", value: "chain" },
                { label: "全部步骤", value: "all" },
              ]}
            />
            {displayScope === "workflow" ? <Tag>{stageCount} 个阶段 · {handoffCount} 次交接</Tag> : null}
            <Tag>{agentCount} 个智能体</Tag>
            <Tag>{toolCount} 次工具调用</Tag>
            {failedCount > 0 ? <Tag color="error">{failedCount} 个异常</Tag> : null}
            <Tooltip title="刷新执行链">
              <Button icon={<RefreshCcw size={15} />} onClick={() => void loadLatest()} loading={loading} />
            </Tooltip>
          </Space>
        </div>

        {error ? <Alert type="warning" showIcon message={error} action={<Button size="small" onClick={() => void loadLatest()}>重试</Button>} /> : null}

        {loading && events.length === 0 ? (
          <div className="execution-chain-loading"><Skeleton active paragraph={{ rows: 5 }} /></div>
        ) : visibleEvents.length === 0 ? (
          <div className="execution-chain-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={filteredEvents.length > 0 && displayScope === "workflow"
                ? "当前任务生成于顶层编排事件上线前；可切换到“工具调用”或“全部步骤”查看既有记录。"
                : filteredEvents.length > 0 && displayScope === "chain"
                ? "当前范围暂无工具调用；可以切换到“全部步骤”查看模型决策。"
                : selectedAgent !== "all"
                ? "该智能体暂无结构化执行事件。"
                : taskStatus === TaskStatus.RUNNING
                  ? "任务尚未产生结构化调用，系统会在 Agent 开始推理和调用工具后自动记录。"
                  : "该任务生成于结构化采集上线前；原始日志仍可查看，但系统不会伪造调用关系。"}
            />
          </div>
        ) : (
          <div className="execution-chain-list">
            {hasMore ? (
              <Button className="execution-load-earlier" onClick={() => void loadEarlier()} loading={loadingEarlier}>
                加载更早事件
              </Button>
            ) : null}
            {visibleEvents.map((event) => {
              const depth = eventDepth.get(event.event_id) ?? 0;
              return (
                <button
                  key={event.event_id}
                  type="button"
                  className={`execution-chain-item status-${event.status}${depth > 0 ? " is-child" : ""}`}
                  style={{ marginLeft: depth * 26, width: `calc(100% - ${depth * 26}px)` }}
                  onClick={() => openDetail(event)}
                >
                  <span className="execution-chain-node">{eventIcon(event)}</span>
                  <span className="execution-chain-content">
                    <span className="execution-chain-meta">
                      <span className="log-time">{formatTime(event.started_at)}</span>
                      <Tag className="agent-tag">{agentDisplayName(event.agent)}</Tag>
                      <Tag>{phaseLabel(event.phase)}</Tag>
                      {statusTag(event.status)}
                    </span>
                    <span className="execution-chain-title">
                      <strong>{eventKindLabel(event)}</strong>
                      <code>{eventTitle(event)}</code>
                    </span>
                    <Typography.Paragraph ellipsis={{ rows: 2 }}>{eventPreview(event)}</Typography.Paragraph>
                    <span className="execution-chain-foot">
                      {event.duration_ms !== null && event.duration_ms !== undefined ? <span><Clock3 size={13} /> {event.duration_ms} ms</span> : null}
                      {event.correlation_id ? <span><Hash size={13} /> {event.correlation_id}</span> : null}
                      {event.evidence_refs.length > 0 ? <span><ShieldCheck size={13} /> {event.evidence_refs.length} 条证据</span> : null}
                    </span>
                  </span>
                  <ChevronRight size={16} className="execution-chain-open" />
                </button>
              );
            })}
          </div>
        )}

        <div className="execution-chain-footer">
          当前展示 {visibleEvents.length} / {selectedAgent === "all" ? total : filteredEvents.length} 个事件
        </div>
      </section>

      <Drawer
        title="执行步骤详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        size="large"
        className="execution-detail-drawer"
        extra={selectedEvent ? (
          <Button
            icon={<Copy size={14} />}
            onClick={async () => {
              await navigator.clipboard.writeText(JSON.stringify(selectedEvent, null, 2));
              message.success("执行事件 JSON 已复制");
            }}
          >
            复制 JSON
          </Button>
        ) : null}
      >
        {!selectedEvent ? null : (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <div className="execution-detail-heading">
              <Space size={8} wrap>
                {eventIcon(selectedEvent)}
                <Typography.Title level={4}>{eventTitle(selectedEvent)}</Typography.Title>
                {statusTag(selectedEvent.status)}
              </Space>
              <Typography.Text type="secondary">{eventKindLabel(selectedEvent)} · {phaseLabel(selectedEvent.phase)}</Typography.Text>
            </div>

            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="事件 ID">
                <Typography.Text copyable className="text-mono">{selectedEvent.event_id}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="父事件">
                {selectedEvent.parent_event_id
                  ? <Typography.Text copyable className="text-mono">{selectedEvent.parent_event_id}</Typography.Text>
                  : "根步骤"}
              </Descriptions.Item>
              <Descriptions.Item label="调用关联 ID">
                {selectedEvent.correlation_id
                  ? <Typography.Text copyable className="text-mono">{selectedEvent.correlation_id}</Typography.Text>
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="耗时">{selectedEvent.duration_ms ?? "—"} ms</Descriptions.Item>
              <Descriptions.Item label="完整性">
                <Space size={8} wrap>
                  <Tag icon={<ShieldCheck size={12} />}>已脱敏</Tag>
                  <span>{formatBytes(selectedEvent.output_size)}</span>
                  {selectedEvent.output_sha256 ? (
                    <Typography.Text copyable={{ text: selectedEvent.output_sha256 }} className="text-mono">
                      SHA-256 {selectedEvent.output_sha256.slice(0, 12)}…
                    </Typography.Text>
                  ) : "—"}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {detailLoading ? <Skeleton active paragraph={{ rows: 4 }} /> : null}

            {!detailLoading ? <WorkflowEventView event={selectedEvent} /> : null}

            {!detailLoading && detailOutput ? <NodeStateView output={detailOutput} /> : null}

            {!detailLoading ? (
              <div className="execution-payload-grid">
                <JsonPayload title={selectedEvent.event_type === "agent.handoff" ? "结构化交接输入" : "调用参数"} value={selectedEvent.input} />
                <JsonPayload title={selectedEvent.event_type === "agent.handoff" ? "结构化交接产物" : "工具返回"} value={selectedEvent.output} />
              </div>
            ) : null}

            {selectedEvent.evidence_refs.length > 0 ? (
              <div className="execution-detail-section">
                <Space size={8}><ShieldCheck size={15} /><Typography.Text strong>证据引用</Typography.Text></Space>
                <div className="execution-event-chips">
                  {selectedEvent.evidence_refs.map((reference) => <Tag key={reference}>{reference}</Tag>)}
                </div>
              </div>
            ) : null}

            <details className="execution-raw-json">
              <summary><Braces size={14} /> 查看完整事件 JSON</summary>
              <pre>{JSON.stringify(selectedEvent, null, 2)}</pre>
            </details>
          </Space>
        )}
      </Drawer>
    </>
  );
};

export default ExecutionChainPanel;
