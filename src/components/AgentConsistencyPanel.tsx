import React, { useMemo } from "react";
import { Progress, Space, Tag, Typography } from "antd";
import { GitCompareArrows, Network, ShieldCheck, TriangleAlert } from "lucide-react";
import { AutomatedReviewResponse, ConsistencyStatus, LanguageMode, MacroAnalysisResponse, Task, TaskEvent } from "../types";
import { analyzeAgentConsistency } from "../utils/agentConsistency";

interface AgentConsistencyPanelProps {
  task: Task | null;
  events: TaskEvent[];
  macro: MacroAnalysisResponse | null;
  review?: AutomatedReviewResponse | null;
  language?: LanguageMode;
}

function statusColor(status: ConsistencyStatus) {
  if (status === "pass") return "success";
  if (status === "warning") return "warning";
  return "error";
}

function progressStatus(status: ConsistencyStatus) {
  return status === "risk" ? "exception" : "normal";
}

const AgentConsistencyPanel: React.FC<AgentConsistencyPanelProps> = ({
  task,
  events,
  macro,
  review,
  language = "zh",
}) => {
  const isZh = language === "zh";
  const localSummary = useMemo(() => analyzeAgentConsistency(task, events, macro), [events, macro, task]);
  const summary = review
    ? {
        score: review.score,
        status: review.status,
        checks: review.checks,
        agentSignals: review.agent_signals,
        sharedTransactions: review.shared_transactions,
        sharedFunctions: review.shared_functions,
      }
    : localSummary;

  return (
    <section className="agent-consistency-card">
      <div className="agent-consistency-head">
        <Space size={8}>
          <GitCompareArrows size={16} />
          <div>
            <Typography.Text strong>{isZh ? "多 Agent 一致性检查" : "Cross-Agent Consistency"}</Typography.Text>
            <Typography.Text type="secondary">
              {isZh
                ? "检查宏观交易筛选、Trace 调试、根因定位、补丁生成和补丁验证之间是否连续。"
                : "Checks continuity across macro transaction selection, trace debugging, localization, patching, and verification."}
            </Typography.Text>
          </div>
        </Space>
        <Space size={6}>
          <Tag color={review ? "cyan" : "default"}>{review ? "backend review" : "local review"}</Tag>
          <Tag color={statusColor(summary.status)}>{summary.status}</Tag>
        </Space>
      </div>

      <div className="agent-consistency-overview">
        <div className="agent-consistency-score">
          <Progress
            type="circle"
            percent={summary.score}
            size={76}
            status={progressStatus(summary.status)}
          />
          <Typography.Text type="secondary">
            {isZh ? "结论连续性" : "Conclusion continuity"}
          </Typography.Text>
        </div>
        <div className="agent-consistency-shared">
          <div>
            <Space size={6}>
              <Network size={14} />
              <Typography.Text strong>{isZh ? "共享交易" : "Shared transactions"}</Typography.Text>
            </Space>
            <div className="consistency-chip-row">
              {summary.sharedTransactions.length ? (
                summary.sharedTransactions.slice(0, 5).map((item) => (
                  <Tag key={item.value} color="cyan">
                    {item.value.slice(0, 10)}... · {item.agents.length} agents
                  </Tag>
                ))
              ) : (
                <Tag>{isZh ? "暂无共享交易" : "none"}</Tag>
              )}
            </div>
          </div>
          <div>
            <Space size={6}>
              <ShieldCheck size={14} />
              <Typography.Text strong>{isZh ? "共享函数" : "Shared functions"}</Typography.Text>
            </Space>
            <div className="consistency-chip-row">
              {summary.sharedFunctions.length ? (
                summary.sharedFunctions.slice(0, 6).map((item) => (
                  <Tag key={item.value} color="purple">
                    {item.value} · {item.agents.length} agents
                  </Tag>
                ))
              ) : (
                <Tag>{isZh ? "暂无共享函数" : "none"}</Tag>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="consistency-check-grid">
        {summary.checks.map((check) => (
          <article className={`consistency-check-card check-${check.status}`} key={check.id}>
            <div className="consistency-check-title">
              <div>
                <Typography.Text strong>{check.title}</Typography.Text>
                <Typography.Paragraph>{check.description}</Typography.Paragraph>
              </div>
              <Tag color={statusColor(check.status)}>{check.score}</Tag>
            </div>
            <Progress
              percent={check.score}
              size="small"
              status={progressStatus(check.status)}
              showInfo={false}
            />
            <ul>
              {check.evidence.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {check.recommendation ? (
              <div className="consistency-recommendation">
                <TriangleAlert size={13} />
                <span>{check.recommendation}</span>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
};

export default AgentConsistencyPanel;
