import React, { useMemo, useState } from "react";
import { Button, Progress, Space, Tag, Typography } from "antd";
import { Activity, Database, SearchCheck, ShieldCheck, TriangleAlert, Wrench } from "lucide-react";
import { EvidenceItem, LanguageMode, ReportSectionKey } from "../types";
import { enrichEvidenceItems, summarizeEvidenceHealth } from "../utils/evidenceScoring";
import EvidenceDrawer from "./EvidenceDrawer";

interface EvidenceSection {
  key: ReportSectionKey;
  title: string;
  content: string;
  evidence: EvidenceItem[];
}

interface EvidenceIntelligencePanelProps {
  sections: EvidenceSection[];
  language?: LanguageMode;
}

function scoreColor(label: string) {
  if (label === "strong") return "success";
  if (label === "supporting") return "processing";
  return "exception";
}

function scoreLabel(label: string, isZh: boolean) {
  if (!isZh) return label;
  if (label === "strong") return "证据充分";
  if (label === "supporting") return "基本支撑";
  return "证据偏弱";
}

function riskLabel(risk: string, isZh: boolean) {
  if (!isZh) return risk;
  const labels: Record<string, string> = {
    "no linked evidence": "暂无关联证据",
    "no direct transaction hash": "缺少直接交易哈希",
    "no tool-backed evidence": "缺少工具调用证据",
    "single-agent evidence": "证据仅来自单一智能体",
    "mostly weak evidence": "弱证据占比较高",
  };
  return labels[risk] ?? risk;
}

const EvidenceIntelligencePanel: React.FC<EvidenceIntelligencePanelProps> = ({ sections, language = "zh" }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isZh = language === "zh";
  const allEvidence = useMemo(() => sections.flatMap((section) => section.evidence), [sections]);
  const enrichedEvidence = useMemo(() => enrichEvidenceItems(allEvidence).slice(0, 12), [allEvidence]);
  const health = useMemo(() => summarizeEvidenceHealth(allEvidence), [allEvidence]);

  return (
    <section className="evidence-intelligence-card evidence-intelligence-compact">
      <div className="evidence-compact-main">
        <div className="evidence-compact-title">
          <ShieldCheck size={17} />
          <div>
            <Space size={7} wrap>
              <Typography.Text strong>{isZh ? "证据质量" : "Evidence quality"}</Typography.Text>
              <Tag color={scoreColor(health.label)}>{scoreLabel(health.label, isZh)}</Tag>
            </Space>
            <Typography.Text type="secondary">
              {isZh ? "用于说明报告依据是否充分，不代表模型置信概率。" : "Support quality, not model confidence."}
            </Typography.Text>
          </div>
        </div>

        <div className="evidence-compact-score">
          <strong>{health.score}%</strong>
          <span>{isZh ? "支撑度" : "support"}</span>
        </div>

        <div className="evidence-compact-metrics">
          <span><ShieldCheck size={14} /> {health.strong} {isZh ? "条强证据" : "strong"}</span>
          <span><Activity size={14} /> {health.supporting} {isZh ? "条辅助证据" : "supporting"}</span>
          <span><Database size={14} /> {health.transactions} {isZh ? "笔链上交易" : "transactions"}</span>
          <span><Wrench size={14} /> {health.tools} {isZh ? "条工具证据" : "tool-backed"}</span>
        </div>

        <Button size="small" icon={<SearchCheck size={14} />} onClick={() => setDrawerOpen(true)}>
          {isZh ? "查看代表性证据" : "View evidence"}
        </Button>
      </div>

      <Progress
        percent={health.score}
        size="small"
        status={health.label === "weak" ? "exception" : "normal"}
        showInfo={false}
      />

      {health.risks.length ? (
        <div className="evidence-compact-risk">
          <TriangleAlert size={14} />
          <span>{health.risks.slice(0, 2).map((risk) => riskLabel(risk, isZh)).join("；")}</span>
        </div>
      ) : null}

      <EvidenceDrawer
        title={isZh ? "代表性强证据" : "Top ranked evidence"}
        open={drawerOpen}
        evidence={enrichedEvidence}
        onClose={() => setDrawerOpen(false)}
      />
    </section>
  );
};

export default EvidenceIntelligencePanel;
