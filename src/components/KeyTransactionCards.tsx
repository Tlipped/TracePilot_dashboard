import React, { useMemo, useState } from "react";
import { Button, Empty, Space, Tag, Typography } from "antd";
import { KeyRound, SearchCheck } from "lucide-react";
import { EvidenceItem, LogMessage, Task, TaskEvent } from "../types";
import {
  compactEvidenceText,
  extractTransactionHashes,
  isLogEvent,
  isLowValueOperationalLog,
} from "../utils/evidence";
import EvidenceDrawer from "./EvidenceDrawer";

interface KeyTransactionCardsProps {
  task: Task | null;
  events: TaskEvent[];
}

interface KeyTransaction {
  hash: string;
  role: string;
  action: string;
  evidence: EvidenceItem[];
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function getReportParagraphs(report: string) {
  return report
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function inferRole(text: string, index: number, total: number) {
  const normalized = text.toLowerCase();
  if (/create|prepare|init|liquidity|pool|部署|创建|初始化|流动性/.test(normalized)) return "Preparation";
  if (/trigger|convert|execute|swap|call|触发|调用|执行|兑换/.test(normalized)) return "Exploit Trigger";
  if (/manipulate|storage|price|slippage|reserve|操纵|价格|滑点|储备/.test(normalized)) return "State Manipulation";
  if (/profit|benefit|gain|transfer|withdraw|获利|收益|转移|提现/.test(normalized)) return "Profit";
  if (index === 0) return "Preparation";
  if (index === total - 1 && total > 1) return "Profit / Finalization";
  return "Exploit Step";
}

function logsMentioningHash(logs: LogMessage[], hash: string) {
  return logs.filter((log) => log.message.includes(hash)).slice(-4);
}

function buildTransactions(task: Task | null, events: TaskEvent[]): KeyTransaction[] {
  const report = task?.final_report ?? "";
  const logs = events.filter(isLogEvent).filter((log) => !isLowValueOperationalLog(log));
  const logText = logs
    .slice(-300)
    .map((log) => log.message)
    .join("\n");
  const hashes = extractTransactionHashes(`${report}\n${logText}`).slice(0, 8);
  const paragraphs = getReportParagraphs(report);

  return hashes.map((hash, index) => {
    const reportContext =
      paragraphs.find((paragraph) => paragraph.includes(hash)) ??
      logs.find((log) => log.message.includes(hash))?.message ??
      "";
    const action = reportContext
      ? compactEvidenceText(reportContext, 220)
      : "Transaction was referenced by the analysis. Evidence details are available in linked logs.";
    const relatedLogs = logsMentioningHash(logs, hash);
    const role = inferRole(`${reportContext}\n${relatedLogs.map((log) => log.message).join("\n")}`, index, hashes.length);

    const evidence: EvidenceItem[] = [
      {
        id: `tx-${hash}`,
        title: `Transaction ${shortHash(hash)}`,
        source: "transaction",
        content: hash,
        confidence: "high",
      },
    ];

    if (reportContext) {
      evidence.push({
        id: `tx-report-${hash}`,
        title: "Report context",
        source: "report",
        content: compactEvidenceText(reportContext, 700),
        confidence: "medium",
      });
    }

    relatedLogs.forEach((log, logIndex) => {
      evidence.push({
        id: `tx-log-${hash}-${log.log_id ?? logIndex}`,
        title: `${log.agent} transaction evidence`,
        source: log.message_type === "tool" ? "tool" : "agent_log",
        agent: log.agent,
        level: log.level,
        message_type: log.message_type,
        timestamp: log.timestamp,
        log_id: log.log_id,
        content: compactEvidenceText(log.message),
        confidence: log.message_type === "tool" ? "high" : "medium",
      });
    });

    return { hash, role, action, evidence };
  });
}

const KeyTransactionCards: React.FC<KeyTransactionCardsProps> = ({ task, events }) => {
  const [selectedTx, setSelectedTx] = useState<KeyTransaction | null>(null);
  const transactions = useMemo(() => buildTransactions(task, events), [events, task]);

  if (transactions.length === 0) {
    return (
      <section className="product-summary-card">
        <div className="product-summary-head">
          <Space size={8}>
            <KeyRound size={16} />
            <Typography.Text strong>Key Transactions</Typography.Text>
          </Space>
          <Tag>pending</Tag>
        </div>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No transaction evidence extracted yet" />
      </section>
    );
  }

  return (
    <section className="product-summary-card">
      <div className="product-summary-head">
        <Space size={8}>
          <KeyRound size={16} />
          <Typography.Text strong>Key Transactions</Typography.Text>
        </Space>
        <Tag color="cyan">{transactions.length} tx</Tag>
      </div>

      <div className="key-transaction-grid">
        {transactions.map((tx) => (
          <article className="key-transaction-card" key={tx.hash}>
            <div className="key-transaction-meta">
              <Typography.Text copyable={{ text: tx.hash }} className="text-mono">
                {shortHash(tx.hash)}
              </Typography.Text>
              <Tag>{tx.role}</Tag>
            </div>
            <Typography.Paragraph ellipsis={{ rows: 3 }} className="key-transaction-action">
              {tx.action}
            </Typography.Paragraph>
            <Button size="small" icon={<SearchCheck size={14} />} onClick={() => setSelectedTx(tx)}>
              Evidence
            </Button>
          </article>
        ))}
      </div>

      <EvidenceDrawer
        title={selectedTx ? `${shortHash(selectedTx.hash)} Evidence` : "Transaction Evidence"}
        open={Boolean(selectedTx)}
        evidence={selectedTx?.evidence ?? []}
        onClose={() => setSelectedTx(null)}
      />
    </section>
  );
};

export default KeyTransactionCards;
