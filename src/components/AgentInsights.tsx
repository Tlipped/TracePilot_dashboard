import React, { useMemo } from "react";
import { Empty, Progress, Space, Tag, Typography } from "antd";
import { AlertTriangle, Bot, CheckCircle2, FileText, MessageSquareText, Wrench } from "lucide-react";
import { AGENT_NAMES } from "../constants/agents";
import { LogLevel, LogMessage, MsgType, TaskEvent } from "../types";

interface AgentInsightsProps {
  events: TaskEvent[];
  selectedAgent: string | "all";
  onSelectAgent: (agent: string | "all") => void;
  onSelectLog: (log: LogMessage) => void;
}

interface Insight {
  name: string;
  total: number;
  errors: number;
  warnings: number;
  toolCalls: number;
  results: number;
  markdowns: number;
  lastLog?: LogMessage;
}

function isLogEvent(event: TaskEvent): event is LogMessage {
  return event.type === "LOG";
}

function compactText(value: string, limit = 118) {
  const cleaned = value
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/[#*_>`{}[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}...` : cleaned;
}

function getHealth(insight: Insight): "idle" | "ok" | "warning" | "error" {
  if (insight.errors > 0) return "error";
  if (insight.warnings > 0) return "warning";
  if (insight.total > 0) return "ok";
  return "idle";
}

function getHealthTag(health: ReturnType<typeof getHealth>) {
  if (health === "error") return <Tag color="error">error</Tag>;
  if (health === "warning") return <Tag color="warning">warning</Tag>;
  if (health === "ok") return <Tag color="success">observed</Tag>;
  return <Tag>idle</Tag>;
}

const AgentInsights: React.FC<AgentInsightsProps> = ({ events, selectedAgent, onSelectAgent, onSelectLog }) => {
  const insights = useMemo<Insight[]>(() => {
    const map = new Map<string, Insight>();
    AGENT_NAMES.forEach((name) => {
      map.set(name, {
        name,
        total: 0,
        errors: 0,
        warnings: 0,
        toolCalls: 0,
        results: 0,
        markdowns: 0,
      });
    });

    events.forEach((event) => {
      if (!isLogEvent(event)) return;
      const current =
        map.get(event.agent) ??
        ({
          name: event.agent,
          total: 0,
          errors: 0,
          warnings: 0,
          toolCalls: 0,
          results: 0,
          markdowns: 0,
        } satisfies Insight);

      current.total += 1;
      if (event.level === LogLevel.ERROR) current.errors += 1;
      if (event.level === LogLevel.WARNING) current.warnings += 1;
      if (event.message_type === MsgType.TOOL_CALL) current.toolCalls += 1;
      if (event.message_type === MsgType.RESULT) current.results += 1;
      if (event.message_type === MsgType.MARKDOWN) current.markdowns += 1;
      current.lastLog = event;
      map.set(event.agent, current);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [events]);

  const active = insights.filter((item) => item.total > 0);
  const maxTotal = Math.max(...insights.map((item) => item.total), 1);
  const selectedInsights = selectedAgent === "all" ? insights : insights.filter((item) => item.name === selectedAgent);

  return (
    <div className="agent-insights-panel">
      <div className="insight-metrics">
        <div>
          <span className="metric-value">{active.length}</span>
          <span className="metric-label">active agents</span>
        </div>
        <div>
          <span className="metric-value">{active.reduce((sum, item) => sum + item.toolCalls, 0)}</span>
          <span className="metric-label">tool calls</span>
        </div>
        <div>
          <span className="metric-value">{active.reduce((sum, item) => sum + item.results, 0)}</span>
          <span className="metric-label">results</span>
        </div>
      </div>

      <div className="insight-list">
        {selectedInsights.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No agent insights" />
        ) : (
          selectedInsights.map((insight) => {
            const health = getHealth(insight);
            const selected = selectedAgent === insight.name;
            return (
              <div
                key={insight.name}
                className={selected ? "insight-card selected" : "insight-card"}
                role="button"
                tabIndex={0}
                onClick={() => onSelectAgent(selected ? "all" : insight.name)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onSelectAgent(selected ? "all" : insight.name);
                }}
              >
                <div className="insight-card-head">
                  <Space size={7}>
                    <Bot size={15} />
                    <Typography.Text strong>{insight.name}</Typography.Text>
                  </Space>
                  {getHealthTag(health)}
                </div>

                <Progress
                  percent={Math.round((insight.total / maxTotal) * 100)}
                  showInfo={false}
                  size="small"
                  status={health === "error" ? "exception" : health === "ok" ? "success" : "normal"}
                />

                <div className="insight-counts">
                  <span>
                    <MessageSquareText size={13} />
                    {insight.total}
                  </span>
                  <span>
                    <Wrench size={13} />
                    {insight.toolCalls}
                  </span>
                  <span>
                    <CheckCircle2 size={13} />
                    {insight.results}
                  </span>
                  <span>
                    <FileText size={13} />
                    {insight.markdowns}
                  </span>
                  {insight.errors + insight.warnings > 0 ? (
                    <span className={insight.errors > 0 ? "text-red" : "text-warning"}>
                      <AlertTriangle size={13} />
                      {insight.errors + insight.warnings}
                    </span>
                  ) : null}
                </div>

                {insight.lastLog ? (
                  <div
                    className="insight-last"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectLog(insight.lastLog as LogMessage);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && insight.lastLog) onSelectLog(insight.lastLog);
                    }}
                  >
                    <Typography.Text type="secondary">Latest</Typography.Text>
                    <Typography.Paragraph ellipsis={{ rows: 2 }}>{compactText(insight.lastLog.message)}</Typography.Paragraph>
                  </div>
                ) : (
                  <Typography.Text type="secondary">Waiting for activity.</Typography.Text>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AgentInsights;
