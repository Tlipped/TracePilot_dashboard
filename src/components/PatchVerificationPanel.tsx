import React, { useMemo, useState } from "react";
import { Button, Progress, Space, Tag, Typography } from "antd";
import { AlertTriangle, CheckCircle2, SearchCheck, ShieldCheck } from "lucide-react";
import { EvidenceItem, LogMessage, Task, TaskEvent } from "../types";
import {
  compactEvidenceText,
  isLogEvent,
  isLowValueOperationalLog,
} from "../utils/evidence";
import EvidenceDrawer from "./EvidenceDrawer";

interface PatchVerificationPanelProps {
  task: Task | null;
  events: TaskEvent[];
}

interface PatchVerificationSummary {
  status: "verified" | "partial" | "failed" | "pending";
  title: string;
  description: string;
  score: number;
  evidence: EvidenceItem[];
}

function pickParagraph(report: string, keywords: string[]) {
  const normalized = keywords.map((keyword) => keyword.toLowerCase());
  return (
    report
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .find((paragraph) => {
        const haystack = paragraph.toLowerCase();
        return normalized.some((keyword) => haystack.includes(keyword));
      }) ?? ""
  );
}

function isPatchLog(log: LogMessage) {
  const text = `${log.agent} ${log.message}`.toLowerCase();
  return /patch|verify|verification|validation|replay|success|failure|fix|补丁|验证|重放|修复|抵挡|失败|成功/.test(text);
}

function buildPatchEvidence(report: string, logs: LogMessage[]): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];
  const reportContext = pickParagraph(report, [
    "verification",
    "validation",
    "replay",
    "patch",
    "verify",
    "验证",
    "补丁",
    "重放",
    "抵挡",
  ]);

  if (reportContext) {
    evidence.push({
      id: "patch-report-context",
      title: "Report verification context",
      source: "report",
      content: compactEvidenceText(reportContext, 900),
      confidence: "medium",
    });
  }

  logs
    .filter(isPatchLog)
    .slice(-8)
    .forEach((log, index) => {
      evidence.push({
        id: `patch-log-${log.log_id ?? index}`,
        title: `${log.agent} patch evidence`,
        source: log.message_type === "tool" ? "tool" : "agent_log",
        agent: log.agent,
        level: log.level,
        message_type: log.message_type,
        timestamp: log.timestamp,
        log_id: log.log_id,
        content: compactEvidenceText(log.message, 900),
        confidence: /success|verified|抵挡|成功|passed/i.test(log.message) ? "high" : "medium",
      });
    });

  return evidence;
}

function buildSummary(task: Task | null, events: TaskEvent[]): PatchVerificationSummary {
  const report = task?.final_report ?? "";
  const logs = events.filter(isLogEvent).filter((log) => !isLowValueOperationalLog(log));
  const evidence = buildPatchEvidence(report, logs);
  const haystack = `${report}\n${logs.map((log) => log.message).join("\n")}`.toLowerCase();

  const hasSuccess = /success|verified|passed|blocked|resist|抵挡|阻断|成功|通过/.test(haystack);
  const hasFailure = /fail|failed|failure|error|not verified|失败|未通过|无法验证/.test(haystack);
  const hasPatchSignal = /patch|fix|mitigation|verify|validation|replay|补丁|修复|验证|重放/.test(haystack);

  if (hasSuccess && !hasFailure) {
    return {
      status: "verified",
      title: "Patch verification passed",
      description: "The available report/log evidence indicates that the proposed patch blocked or resisted the replayed attack path.",
      score: 92,
      evidence,
    };
  }

  if (hasSuccess && hasFailure) {
    return {
      status: "partial",
      title: "Patch verification partially supported",
      description: "The analysis contains both success and failure signals. Review linked evidence before treating the patch as fully verified.",
      score: 62,
      evidence,
    };
  }

  if (hasFailure) {
    return {
      status: "failed",
      title: "Patch verification needs attention",
      description: "The available evidence includes failure or unresolved verification signals.",
      score: 34,
      evidence,
    };
  }

  if (hasPatchSignal) {
    return {
      status: "pending",
      title: "Patch verification evidence is incomplete",
      description: "Patch-related content exists, but no clear pass/fail signal has been extracted yet.",
      score: 48,
      evidence,
    };
  }

  return {
    status: "pending",
    title: "Patch verification pending",
    description: "No explicit patch replay or verification signal has been extracted yet.",
    score: 18,
    evidence,
  };
}

function statusColor(status: PatchVerificationSummary["status"]) {
  if (status === "verified") return "success";
  if (status === "partial") return "active";
  if (status === "failed") return "exception";
  return "normal";
}

function tagColor(status: PatchVerificationSummary["status"]) {
  if (status === "verified") return "success";
  if (status === "partial") return "warning";
  if (status === "failed") return "error";
  return "default";
}

const PatchVerificationPanel: React.FC<PatchVerificationPanelProps> = ({ task, events }) => {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => buildSummary(task, events), [events, task]);
  const Icon = summary.status === "failed" || summary.status === "partial" ? AlertTriangle : ShieldCheck;

  return (
    <section className="product-summary-card patch-verification-card">
      <div className="product-summary-head">
        <Space size={8}>
          <Icon size={16} />
          <Typography.Text strong>Patch Verification</Typography.Text>
        </Space>
        <Tag color={tagColor(summary.status)}>{summary.status}</Tag>
      </div>

      <div className="patch-verification-body">
        <div className="patch-score">
          <Progress
            type="circle"
            size={78}
            percent={summary.score}
            status={statusColor(summary.status)}
            format={() => (summary.status === "verified" ? <CheckCircle2 size={22} /> : `${summary.score}%`)}
          />
        </div>
        <div className="patch-summary">
          <Typography.Text strong>{summary.title}</Typography.Text>
          <Typography.Paragraph>{summary.description}</Typography.Paragraph>
          <Space size={8} wrap>
            <Tag color={summary.evidence.length > 0 ? "cyan" : "default"}>{summary.evidence.length} evidence</Tag>
            <Button size="small" icon={<SearchCheck size={14} />} onClick={() => setOpen(true)}>
              Evidence
            </Button>
          </Space>
        </div>
      </div>

      <EvidenceDrawer
        title="Patch Verification Evidence"
        open={open}
        evidence={summary.evidence}
        onClose={() => setOpen(false)}
      />
    </section>
  );
};

export default PatchVerificationPanel;
