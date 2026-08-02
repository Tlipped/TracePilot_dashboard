import React, { useEffect, useMemo, useState } from "react";
import { Button, Empty, Space, Tag, Typography } from "antd";
import { ArrowLeft, ArrowRight, FileText, GitBranch, SearchCheck } from "lucide-react";
import { EvidenceItem, ProductViewMode, Task, TaskEvent } from "../types";
import {
  buildAttackPhaseEvidence,
  compactEvidenceText,
  extractTransactionHashes,
} from "../utils/evidence";
import EvidenceDrawer from "./EvidenceDrawer";

interface AttackReplayTimelineProps {
  task: Task | null;
  events: TaskEvent[];
  mode?: ProductViewMode;
}

interface ReportBlock {
  heading: string;
  level: number;
  content: string;
}

export interface AttackPhase {
  key: string;
  title: string;
  description: string;
  sourceHeading: string;
  evidence: EvidenceItem[];
}

const PHASE_STOP_WORDS = new Set([
  "about",
  "after",
  "against",
  "attack",
  "before",
  "from",
  "into",
  "stage",
  "that",
  "their",
  "then",
  "this",
  "through",
  "transaction",
  "with",
]);

function parseReportBlocks(report: string): ReportBlock[] {
  const blocks: ReportBlock[] = [];
  let current: ReportBlock | null = null;

  report.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(#{2,4})\s+(.+?)\s*$/);
    if (match) {
      if (current) blocks.push(current);
      current = {
        heading: match[2],
        level: match[1].length,
        content: "",
      };
      return;
    }

    if (current) current.content += `${line}\n`;
  });

  if (current) blocks.push(current);
  return blocks.map((block) => ({ ...block, content: block.content.trim() }));
}

function cleanPhaseTitle(heading: string) {
  return heading
    .replace(/`/g, "")
    .replace(/^(?:stage|step)\s*\d+(?:\.\d+)?\s*[-—:：]\s*/i, "")
    .replace(/^\d+(?:\.\d+)*[.)、]?\s*/, "")
    .trim();
}

function narrativeFromBlock(block: ReportBlock) {
  const withoutCode = block.content.replace(/```[\s\S]*?```/g, " ");
  const paragraph = withoutCode
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .find((item) =>
      item.length > 30
      && !item.split(/\r?\n/).every((line) => /^\s*\|/.test(line) || /^\s*[-:| ]+\s*$/.test(line)),
    );

  return compactEvidenceText(
    (paragraph || withoutCode)
      .replace(/^\s*\|.*$/gm, " ")
      .replace(/^\s*[-:| ]+\s*$/gm, " ")
      .replace(/[#*_>`[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    260,
  );
}

function phaseKeywords(block: ReportBlock) {
  const text = `${block.heading} ${narrativeFromBlock(block)}`.toLowerCase();
  const english = text.match(/[a-z][a-z0-9_]{3,}/g) ?? [];
  const chinese = text.match(/[\p{Script=Han}]{2,6}/gu) ?? [];
  return Array.from(new Set([...english.filter((word) => !PHASE_STOP_WORDS.has(word)), ...chinese])).slice(0, 10);
}

function findAttackBlocks(report: string) {
  const blocks = parseReportBlocks(report);
  const explicitStages = blocks.filter((block) =>
    /^(?:stage|step)\s*\d+|profit realization|攻击阶段|攻击步骤|获利|资金转移/i.test(block.heading.trim()),
  );
  if (explicitStages.length >= 2) return explicitStages.slice(0, 8);

  const attackSectionIndex = blocks.findIndex((block) =>
    /attack (?:path|flow|reconstruction)|exploit (?:path|flow)|攻击(?:路径|流程|复盘)/i.test(block.heading),
  );
  if (attackSectionIndex >= 0) {
    const parent = blocks[attackSectionIndex];
    const children: ReportBlock[] = [];
    for (let index = attackSectionIndex + 1; index < blocks.length; index += 1) {
      if (blocks[index].level <= parent.level) break;
      if (blocks[index].level === parent.level + 1) children.push(blocks[index]);
    }
    if (children.length >= 2) return children.slice(0, 8);
  }

  const matched = blocks.filter((block) =>
    /setup|prepare|trigger|exploit|swap|transfer|profit|攻击|触发|利用|兑换|转移|获利/i.test(block.heading),
  );
  if (matched.length >= 2) return matched.slice(0, 8);

  return blocks
    .filter((block) => block.level === 2 && narrativeFromBlock(block).length > 30)
    .slice(0, 5);
}

// Shared by the presentation view so legacy reports use the same dynamic phase extraction.
// eslint-disable-next-line react-refresh/only-export-components
export function buildAttackPhases(task: Task | null, events: TaskEvent[]): AttackPhase[] {
  const report = task?.final_report ?? "";
  const usedEvidence = new Set<string>();

  return findAttackBlocks(report).map((block, index) => {
    const transactionEvidence = extractTransactionHashes(block.content).map((hash) => ({
      id: `phase-${index}-tx-${hash}`,
      title: "本步骤关联交易",
      source: "transaction" as const,
      content: hash,
      full_content: hash,
      confidence: "high" as const,
    }));
    const logEvidence = buildAttackPhaseEvidence(events, phaseKeywords(block));
    const evidence = [...transactionEvidence, ...logEvidence]
      .filter((item) => {
        const identity = `${item.source}:${item.content}`;
        if (usedEvidence.has(identity)) return false;
        usedEvidence.add(identity);
        return true;
      })
      .slice(0, 3);

    return {
      key: `report-phase-${index}-${block.heading}`,
      title: cleanPhaseTitle(block.heading) || `关键步骤 ${index + 1}`,
      description: narrativeFromBlock(block) || "最终报告记录了该步骤，但没有可展示的独立摘要。",
      sourceHeading: block.heading,
      evidence,
    };
  });
}

const AttackReplayTimeline: React.FC<AttackReplayTimelineProps> = ({ task, events }) => {
  const phases = useMemo(() => buildAttackPhases(task, events), [events, task]);
  const [selectedKey, setSelectedKey] = useState("");
  const [evidencePhase, setEvidencePhase] = useState<AttackPhase | null>(null);

  useEffect(() => {
    if (!phases.some((phase) => phase.key === selectedKey)) {
      setSelectedKey(phases[0]?.key ?? "");
    }
  }, [phases, selectedKey]);

  const selectedIndex = Math.max(0, phases.findIndex((phase) => phase.key === selectedKey));
  const selectedPhase = phases[selectedIndex];

  if (!task?.final_report || phases.length === 0) {
    return (
      <section className="attack-replay-panel">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="最终报告形成攻击路径后，将在这里生成案件复盘。" />
      </section>
    );
  }

  return (
    <section className="attack-replay-panel attack-story-panel">
      <div className="panel-header attack-story-header">
        <Space size={8}>
          <GitBranch size={16} />
          <div>
            <Typography.Text strong>{task.dapp_name} 攻击链</Typography.Text>
            <Typography.Text type="secondary">
              从本案最终报告提取 {phases.length} 个关键步骤，不套用固定阶段
            </Typography.Text>
          </div>
        </Space>
        <Tag color="blue">报告生成</Tag>
      </div>

      <div className="attack-story-body">
        <div className="attack-story-track" role="tablist" aria-label="案件攻击步骤">
          {phases.map((phase, index) => (
            <button
              type="button"
              role="tab"
              aria-selected={phase.key === selectedPhase?.key}
              className={`attack-story-step${phase.key === selectedPhase?.key ? " active" : ""}`}
              key={phase.key}
              onClick={() => setSelectedKey(phase.key)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{phase.title}</strong>
            </button>
          ))}
        </div>

        {selectedPhase ? (
          <article className="attack-story-focus">
            <div className="attack-story-focus-index">{String(selectedIndex + 1).padStart(2, "0")}</div>
            <div className="attack-story-focus-content">
              <div className="attack-story-focus-head">
                <div>
                  <Typography.Text type="secondary">本案步骤</Typography.Text>
                  <Typography.Title level={4}>{selectedPhase.title}</Typography.Title>
                </div>
                <Tag icon={<FileText size={13} />}>最终报告</Tag>
              </div>
              <Typography.Paragraph>{selectedPhase.description}</Typography.Paragraph>
              <div className="attack-story-actions">
                <Space size={6}>
                  <Button
                    size="small"
                    icon={<ArrowLeft size={14} />}
                    disabled={selectedIndex === 0}
                    onClick={() => setSelectedKey(phases[selectedIndex - 1].key)}
                  >
                    上一步
                  </Button>
                  <Button
                    size="small"
                    disabled={selectedIndex === phases.length - 1}
                    onClick={() => setSelectedKey(phases[selectedIndex + 1].key)}
                  >
                    下一步
                    <ArrowRight size={14} />
                  </Button>
                </Space>
                {selectedPhase.evidence.length > 0 ? (
                  <Button
                    size="small"
                    icon={<SearchCheck size={14} />}
                    onClick={() => setEvidencePhase(selectedPhase)}
                  >
                    查看 {selectedPhase.evidence.length} 条关联证据
                  </Button>
                ) : null}
              </div>
            </div>
          </article>
        ) : null}
      </div>

      <EvidenceDrawer
        title={evidencePhase ? `${evidencePhase.title} · 关联证据` : "关联证据"}
        open={Boolean(evidencePhase)}
        evidence={evidencePhase?.evidence ?? []}
        onClose={() => setEvidencePhase(null)}
      />
    </section>
  );
};

export default AttackReplayTimeline;
