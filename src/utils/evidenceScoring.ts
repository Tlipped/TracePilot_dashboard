import { EvidenceItem, LogLevel, MsgType } from "../types";

export interface EvidenceScoreResult {
  score: number;
  label: "strong" | "supporting" | "weak";
  reasons: string[];
  tier: NonNullable<EvidenceItem["evidence_tier"]>;
}

export interface EvidenceHealthSummary {
  score: number;
  label: "strong" | "supporting" | "weak";
  total: number;
  strong: number;
  supporting: number;
  weak: number;
  transactions: number;
  tools: number;
  agents: number;
  risks: string[];
}

const SECURITY_KEYWORDS = [
  "attack",
  "attacker",
  "exploit",
  "root cause",
  "vulnerab",
  "trace",
  "storage",
  "event",
  "transaction",
  "patch",
  "verify",
  "validation",
  "replay",
  "漏洞",
  "根因",
  "攻击",
  "交易",
  "调用",
  "状态",
  "补丁",
  "验证",
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function labelFromScore(score: number): EvidenceScoreResult["label"] {
  if (score >= 72) return "strong";
  if (score >= 45) return "supporting";
  return "weak";
}

function textOf(item: EvidenceItem) {
  return `${item.title} ${item.content} ${item.full_content || ""}`.toLowerCase();
}

export function isToolBackedEvidence(item: EvidenceItem) {
  return item.source === "tool" || item.message_type === MsgType.TOOL_CALL || item.evidence_tier === "tool_backed";
}

export function inferEvidenceTier(item: EvidenceItem): NonNullable<EvidenceItem["evidence_tier"]> {
  const haystack = textOf(item);
  const hasOnChainRef = /0x[a-f0-9]{40,64}/i.test(haystack);

  if (item.source === "transaction" || (isToolBackedEvidence(item) && hasOnChainRef)) {
    return "verified";
  }
  if (isToolBackedEvidence(item) || item.source === "system") {
    return "tool_backed";
  }
  if (item.source === "agent_log") {
    return "agent_derived";
  }
  return "report_derived";
}

export function scoreEvidenceItem(item: EvidenceItem): EvidenceScoreResult {
  const reasons: string[] = [];
  const haystack = textOf(item);
  const tier = inferEvidenceTier(item);
  let score = 0;

  if (item.source === "transaction") {
    score += 32;
    reasons.push("direct transaction evidence");
  } else if (item.source === "tool") {
    score += 30;
    reasons.push("tool-backed observation");
  } else if (item.source === "system") {
    score += 26;
    reasons.push("structured system output");
  } else if (item.source === "agent_log") {
    score += 20;
    reasons.push("agent reasoning trace");
  } else {
    score += 16;
    reasons.push("report-derived claim");
  }

  if (item.confidence === "high") {
    score += 22;
    reasons.push("strong claim link");
  } else if (item.confidence === "medium") {
    score += 14;
    reasons.push("supporting claim link");
  } else {
    score += 5;
  }

  if (tier === "verified") {
    score += 8;
    reasons.push("verified evidence tier");
  } else if (tier === "report_derived") {
    score -= 6;
    reasons.push("report-only evidence");
  }

  if (item.message_type === MsgType.TOOL_CALL) {
    score += 14;
    reasons.push("contains tool invocation");
  }
  if (item.message_type === MsgType.RESULT) {
    score += 12;
    reasons.push("contains agent result");
  }
  if (item.level === LogLevel.ERROR || item.level === LogLevel.WARNING) {
    score += 4;
    reasons.push("high-signal runtime level");
  }
  if (/0x[a-f0-9]{40,64}/i.test(haystack)) {
    score += 10;
    reasons.push("contains on-chain address or transaction hash");
  }
  if (SECURITY_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
    score += 8;
    reasons.push("matches vulnerability analysis keywords");
  }
  if ((item.full_content || item.content).length > 240) {
    score += 5;
    reasons.push("has enough context");
  }

  const operationalOnly = /task output|interaction:\s*(query|response)|snapshot snippet|耗时|token|统计/i.test(haystack);
  if (operationalOnly && item.source !== "transaction") {
    score -= 18;
    reasons.push("contains operational noise");
  }
  if ((item.full_content || item.content).trim().length < 40) {
    score -= 8;
    reasons.push("short context");
  }

  const finalScore = clamp(score);
  return {
    score: finalScore,
    label: labelFromScore(finalScore),
    reasons: Array.from(new Set(reasons)).slice(0, 5),
    tier,
  };
}

export function enrichEvidenceItem(item: EvidenceItem): EvidenceItem {
  const result = scoreEvidenceItem(item);
  return {
    ...item,
    evidence_tier: result.tier,
    score: result.score,
    score_label: result.label,
    score_reasons: result.reasons,
  };
}

export function enrichEvidenceItems(items: EvidenceItem[]) {
  return items.map(enrichEvidenceItem).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function summarizeEvidenceHealth(items: EvidenceItem[]): EvidenceHealthSummary {
  const enriched = enrichEvidenceItems(items);
  const total = enriched.length;
  const strong = enriched.filter((item) => item.score_label === "strong").length;
  const supporting = enriched.filter((item) => item.score_label === "supporting").length;
  const weak = enriched.filter((item) => item.score_label === "weak").length;
  const transactions = enriched.filter((item) => item.source === "transaction").length;
  const tools = enriched.filter(isToolBackedEvidence).length;
  const agents = new Set(enriched.map((item) => item.agent).filter(Boolean)).size;
  const score = total ? clamp(enriched.reduce((sum, item) => sum + (item.score ?? 0), 0) / total) : 0;
  const risks: string[] = [];

  if (total === 0) risks.push("no linked evidence");
  if (transactions === 0) risks.push("no direct transaction hash");
  if (tools === 0) risks.push("no tool-backed evidence");
  if (agents < 2 && total > 0) risks.push("single-agent evidence");
  if (weak > strong + supporting && total > 0) risks.push("mostly weak evidence");

  return {
    score,
    label: labelFromScore(score),
    total,
    strong,
    supporting,
    weak,
    transactions,
    tools,
    agents,
    risks,
  };
}
