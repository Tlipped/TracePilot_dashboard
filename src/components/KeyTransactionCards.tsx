import React, { useEffect, useMemo, useState } from "react";
import { Button, Empty, Space, Tag, Typography } from "antd";
import {
  BadgeDollarSign,
  Bug,
  CircleHelp,
  KeyRound,
  Route,
  SearchCheck,
  ShieldAlert,
  Target,
  UserRound,
} from "lucide-react";
import {
  EvidenceItem,
  LanguageMode,
  LogMessage,
  MacroAnalysisResponse,
  MacroTransactionSummary,
  Task,
  TaskEvent,
} from "../types";
import { getMacroAnalysis } from "../services/api";
import { t } from "../utils/i18n";
import {
  compactEvidenceText,
  extractTransactionHashes,
  isLogEvent,
  isLowValueOperationalLog,
  normalizeEvidenceMarkdown,
} from "../utils/evidence";
import EvidenceDrawer from "./EvidenceDrawer";

interface KeyTransactionCardsProps {
  task: Task | null;
  events: TaskEvent[];
  macroAnalysis?: MacroAnalysisResponse | null;
  language?: LanguageMode;
}

interface KeyTransaction {
  hash: string;
  role: string;
  type: "attack" | "auxiliary" | "candidate";
  isDebugTarget: boolean;
  action: string;
  macroTx?: MacroTransactionSummary;
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

function formatUsd(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function getTransactionTypeLabel(type: KeyTransaction["type"]) {
  if (type === "attack") return "Attack";
  if (type === "auxiliary") return "Auxiliary";
  return "Candidate";
}

function getTransactionTypeColor(type: KeyTransaction["type"]) {
  if (type === "attack") return "error";
  if (type === "auxiliary") return "processing";
  return "default";
}

function getTransactionTypeIcon(type: KeyTransaction["type"], isDebugTarget: boolean) {
  if (isDebugTarget) return <Target size={16} />;
  if (type === "attack") return <ShieldAlert size={16} />;
  if (type === "auxiliary") return <Route size={16} />;
  return <CircleHelp size={16} />;
}

function roleIcon(role?: string | null) {
  const normalized = (role || "").toLowerCase();
  if (normalized.includes("attacker")) return <Bug size={13} />;
  if (normalized.includes("profit")) return <BadgeDollarSign size={13} />;
  return <UserRound size={13} />;
}

function buildMacroTransactions(macro: MacroAnalysisResponse): KeyTransaction[] {
  return macro.transactions.map((tx) => {
    const roleDescriptions = tx.involved_roles
      .map((item) => `- ${item.address}: ${item.role || "unknown"}\n  ${item.description || ""}`)
      .join("\n");
    const eventLogs = tx.event_logs.map((item) => `- ${item}`).join("\n");
    const balanceLines = tx.balance_summary.top_participants
      .map((participant) => {
        const tokens = participant.tokens
          .slice(0, 4)
          .map((token) => `${token.token}: ${token.amount ?? "N/A"} (${formatUsd(token.usd_value)})`)
          .join("; ");
        return `- ${participant.address}: ${formatUsd(participant.usd_delta)}${tokens ? ` | ${tokens}` : ""}`;
      })
      .join("\n");

    const actionParts = [
      tx.type === "attack"
        ? "Macro analysis classifies this transaction as the main attack transaction."
        : tx.type === "auxiliary"
          ? "Macro analysis classifies this transaction as an auxiliary transaction."
          : "Macro analysis keeps this transaction as a candidate transaction.",
      tx.is_debug_target ? "It is selected as a micro-debugging target." : "",
      tx.function_signature ? `Function signature: ${tx.function_signature}.` : "",
      tx.balance_summary.top_participants.length > 0
        ? `Top balance delta: ${tx.balance_summary.top_participants[0].address} ${formatUsd(tx.balance_summary.top_participants[0].usd_delta)}.`
        : "",
    ].filter(Boolean);

    const evidence: EvidenceItem[] = [
      {
        id: `macro-tx-${tx.hash}`,
        title: `Macro classification: ${getTransactionTypeLabel(tx.type)}`,
        source: "system",
        content: actionParts.join(" "),
        full_content: [
          `## Macro Transaction Classification`,
          "",
          `- Hash: \`${tx.hash}\``,
          `- Type: **${getTransactionTypeLabel(tx.type)}**`,
          `- Debug target: **${tx.is_debug_target ? "yes" : "no"}**`,
          `- From: \`${tx.from || "N/A"}\` (${tx.from_role || "unknown"})`,
          `- To: \`${tx.to || "N/A"}\` (${tx.to_role || "unknown"})`,
          `- Function signature: \`${tx.function_signature || "N/A"}\``,
          `- Status: ${tx.status || "N/A"}`,
          `- Gas used: ${tx.gas_used ?? "N/A"}`,
          `- Cost: ${tx.cost_eth ?? "N/A"} ETH`,
        ].join("\n"),
        confidence: "high",
      },
    ];

    if (roleDescriptions) {
      evidence.push({
        id: `macro-roles-${tx.hash}`,
        title: "Involved address roles",
        source: "system",
        content: compactEvidenceText(roleDescriptions, 600),
        full_content: `## Involved Address Roles\n\n${roleDescriptions}`,
        confidence: "high",
      });
    }

    if (balanceLines) {
      evidence.push({
        id: `macro-balance-${tx.hash}`,
        title: "Balance change summary",
        source: "system",
        content: compactEvidenceText(balanceLines, 600),
        full_content: `## Balance Change Summary\n\n${balanceLines}`,
        confidence: "high",
      });
    }

    if (eventLogs) {
      evidence.push({
        id: `macro-events-${tx.hash}`,
        title: "Decoded event logs",
        source: "system",
        content: compactEvidenceText(eventLogs, 600),
        full_content: `## Decoded Event Logs\n\n${eventLogs}`,
        confidence: "medium",
      });
    }

    return {
      hash: tx.hash,
      role: getTransactionTypeLabel(tx.type),
      type: tx.type,
      isDebugTarget: tx.is_debug_target,
      action: actionParts.join(" "),
      macroTx: tx,
      evidence,
    };
  });
}

function buildFallbackTransactions(task: Task | null, events: TaskEvent[]): KeyTransaction[] {
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
        full_content: hash,
        confidence: "high",
      },
    ];

    if (reportContext) {
      evidence.push({
        id: `tx-report-${hash}`,
        title: "Report context",
        source: "report",
        content: compactEvidenceText(reportContext, 700),
        full_content: normalizeEvidenceMarkdown(reportContext),
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
        full_content: normalizeEvidenceMarkdown(log.message),
        confidence: log.message_type === "tool" ? "high" : "medium",
      });
    });

    return { hash, role, type: "candidate", isDebugTarget: false, action, evidence };
  });
}

const KeyTransactionCards: React.FC<KeyTransactionCardsProps> = ({
  task,
  events,
  macroAnalysis,
  language = "en",
}) => {
  const [selectedTx, setSelectedTx] = useState<KeyTransaction | null>(null);
  const [macro, setMacro] = useState<MacroAnalysisResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (macroAnalysis !== undefined) {
      setMacro(macroAnalysis);
      return;
    }
    if (!task?.task_id) {
      setMacro(null);
      return;
    }
    getMacroAnalysis(task.task_id)
      .then((payload) => {
        if (!cancelled) setMacro(payload);
      })
      .catch(() => {
        if (!cancelled) setMacro(null);
      });
    return () => {
      cancelled = true;
    };
  }, [macroAnalysis, task?.task_id]);

  const transactions = useMemo(
    () => (macro ? buildMacroTransactions(macro) : buildFallbackTransactions(task, events)),
    [events, macro, task],
  );

  if (transactions.length === 0) {
    return (
      <section className="product-summary-card">
        <div className="product-summary-head">
          <Space size={8}>
            <KeyRound size={16} />
            <Typography.Text strong>{language === "zh" ? "关键交易" : "Key Transactions"}</Typography.Text>
          </Space>
          <Tag>pending</Tag>
        </div>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={language === "zh" ? "暂未提取到交易证据" : "No transaction evidence extracted yet"}
        />
      </section>
    );
  }

  return (
    <section className="product-summary-card">
      <div className="product-summary-head">
        <Space size={8}>
          <KeyRound size={16} />
          <Typography.Text strong>{language === "zh" ? "关键交易" : "Key Transactions"}</Typography.Text>
        </Space>
        <Space size={6}>
          {macro ? <Tag color="success">macro</Tag> : <Tag>fallback</Tag>}
          <Tag color="cyan">{transactions.length} tx</Tag>
        </Space>
      </div>

      <div className="key-transaction-grid">
        {transactions.map((tx) => (
          <article className="key-transaction-card" key={tx.hash}>
            <div className="key-transaction-meta">
              <Space size={7}>
                <span className={`tx-type-icon tx-${tx.type}${tx.isDebugTarget ? " tx-debug-target" : ""}`}>
                  {getTransactionTypeIcon(tx.type, tx.isDebugTarget)}
                </span>
                <Typography.Text copyable={{ text: tx.hash }} className="text-mono">
                  {shortHash(tx.hash)}
                </Typography.Text>
              </Space>
              <Space size={4}>
                <Tag color={getTransactionTypeColor(tx.type)}>{tx.role}</Tag>
                {tx.isDebugTarget ? <Tag color="purple">{t(language, "debugTarget")}</Tag> : null}
              </Space>
            </div>
            {tx.macroTx?.involved_roles?.length ? (
              <div className="tx-role-strip">
                {tx.macroTx.involved_roles.slice(0, 3).map((item) => (
                  <Tag key={`${tx.hash}-${item.address}`} className="tx-role-tag">
                    <Space size={4}>
                      {roleIcon(item.role)}
                      {item.role || "unknown"}
                    </Space>
                  </Tag>
                ))}
              </div>
            ) : null}
            <Typography.Paragraph ellipsis={{ rows: 3 }} className="key-transaction-action">
              {tx.action}
            </Typography.Paragraph>
            <Button size="small" icon={<SearchCheck size={14} />} onClick={() => setSelectedTx(tx)}>
              {t(language, "evidence")}
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
