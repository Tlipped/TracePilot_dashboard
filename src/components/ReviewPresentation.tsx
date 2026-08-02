import React, { useEffect, useMemo, useState } from "react";
import { Button, Space, Tag, Typography } from "antd";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Presentation,
  ShieldCheck,
  Target,
} from "lucide-react";
import apeCoinCase from "../data/ApeCoin (APE).json";
import sushiSwapCase from "../data/SushiSwap.json";
import { CaseReviewV1, LocalizedText, Task, TaskEvent } from "../types";
import { buildAttackPhases } from "./AttackReplayTimeline";

const { Paragraph, Text, Title } = Typography;

interface ReviewPresentationProps {
  task: Task;
  review: CaseReviewV1;
  events: TaskEvent[];
}

interface PresentationAttackStage {
  key: string;
  title: string;
  description: string;
  transactionHash?: string | null;
  evidenceCount: number;
}

interface CuratedCaseCopy {
  report_zh: string;
  root_cause_zh: string;
  transaction_hash: string[];
}

const CURATED_CASES: Record<string, CuratedCaseCopy> = {
  sushiswap: sushiSwapCase,
  "apecoin (ape)": apeCoinCase,
  apecoin: apeCoinCase,
  ape: apeCoinCase,
};

type PresentationStep = "overview" | "attack" | "root" | "verification";

const PRESENTATION_STEPS: Array<{
  key: PresentationStep;
  label: string;
  hint: string;
  icon: React.ReactNode;
}> = [
  { key: "overview", label: "案件概览", hint: "先说发生了什么", icon: <Presentation size={17} /> },
  { key: "attack", label: "攻击链", hint: "再看如何完成攻击", icon: <GitBranch size={17} /> },
  { key: "root", label: "根因定位", hint: "解释为什么会成功", icon: <Target size={17} /> },
  { key: "verification", label: "修复验证", hint: "最后证明如何阻断", icon: <ShieldCheck size={17} /> },
];

function localized(value?: LocalizedText | null) {
  if (!value) return "暂无结构化结论";
  return value.zh?.trim() || value.en?.trim() || "暂无结构化结论";
}

function normalizeDappName(value: string) {
  return value.trim().toLowerCase();
}

function compactNarrative(value: string, maxLength = 260) {
  const cleaned = value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*$/gm, " ")
    .replace(/^\s*[-:| ]+\s*$/gm, " ")
    .replace(/[#*_>`[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= maxLength) return cleaned;
  const clipped = cleaned.slice(0, maxLength);
  const sentenceEnd = Math.max(clipped.lastIndexOf("。"), clipped.lastIndexOf("."));
  return `${clipped.slice(0, sentenceEnd > maxLength * 0.55 ? sentenceEnd + 1 : maxLength).trim()}…`;
}

function shortHash(value?: string | null) {
  if (!value) return "暂无";
  return value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

function trustLabel(status: string) {
  if (status === "verified") return { label: "工具验证通过", color: "success" };
  if (status === "reported_verified") return { label: "模型报告通过", color: "processing" };
  if (status === "reported_failed") return { label: "验证未通过", color: "error" };
  if (status === "not_run") return { label: "尚未验证", color: "default" };
  return { label: "证据支持", color: "processing" };
}

function technicalLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "passed") return "已通过";
  if (normalized === "blocked") return "攻击已阻断";
  if (normalized === "reverted") return "攻击已回滚";
  if (normalized === "failed") return "未通过";
  return "暂无工具结果";
}

const ReviewPresentation: React.FC<ReviewPresentationProps> = ({ task, review, events }) => {
  const [activeStep, setActiveStep] = useState<PresentationStep>("overview");
  const [activeAttackStage, setActiveAttackStage] = useState(0);
  const verification = review.patch_verification;
  const trust = trustLabel(verification.verification_status);
  const stepIndex = PRESENTATION_STEPS.findIndex((item) => item.key === activeStep);
  const curatedCase = CURATED_CASES[normalizeDappName(task.dapp_name)];
  const attackStages = useMemo<PresentationAttackStage[]>(() => {
    if (review.attack_stages.length > 0) {
      return review.attack_stages.map((stage) => ({
        key: `${stage.order}-${stage.transaction_hash || stage.title.en}`,
        title: localized(stage.title),
        description: localized(stage.description),
        transactionHash: stage.transaction_hash,
        evidenceCount: stage.evidence_refs.length,
      }));
    }

    return buildAttackPhases(task, events).map((stage) => ({
      key: stage.key,
      title: stage.title,
      description: stage.description,
      transactionHash: stage.evidence.find((item) => item.source === "transaction")?.content,
      evidenceCount: stage.evidence.length,
    }));
  }, [events, review.attack_stages, task]);
  const selectedAttackStage = attackStages[activeAttackStage];
  const firstTransaction = useMemo(
    () => attackStages.find((stage) => stage.transactionHash)?.transactionHash
      || review.evidence.find((item) => item.transaction_hash)?.transaction_hash
      || curatedCase?.transaction_hash[0],
    [attackStages, curatedCase, review.evidence],
  );
  const overviewConclusion = compactNarrative(
    curatedCase?.report_zh || localized(review.executive_summary?.statement),
  );

  useEffect(() => {
    if (activeAttackStage >= attackStages.length) setActiveAttackStage(0);
  }, [activeAttackStage, attackStages.length]);

  const goToStep = (offset: number) => {
    const next = PRESENTATION_STEPS[stepIndex + offset];
    if (next) setActiveStep(next.key);
  };

  return (
    <section className="review-presentation" aria-label={`${task.dapp_name} 评审演示`}>
      <header className="review-presentation-hero">
        <div>
          <Space size={8} wrap>
            <Tag color="blue">评审演示</Tag>
            {task.task_id.startsWith("demo-") ? <Tag color="green">离线快照</Tag> : null}
          </Space>
          <Title level={2}>{task.dapp_name} 攻击复盘</Title>
          <Text type="secondary">四步讲清案件事实、攻击路径、漏洞根因与修复结果</Text>
        </div>
        <div className="review-presentation-identity">
          <span>任务状态</span>
          <strong>{review.task_status === "completed" ? "分析完成" : review.task_status}</strong>
        </div>
      </header>

      <nav className="review-presentation-nav" aria-label="演示步骤">
        {PRESENTATION_STEPS.map((item, index) => (
          <button
            type="button"
            key={item.key}
            className={activeStep === item.key ? "active" : ""}
            onClick={() => setActiveStep(item.key)}
            aria-current={activeStep === item.key ? "step" : undefined}
          >
            <span className="review-presentation-nav-index">{index + 1}</span>
            <span className="review-presentation-nav-icon">{item.icon}</span>
            <span><strong>{item.label}</strong><small>{item.hint}</small></span>
          </button>
        ))}
      </nav>

      <main className="review-presentation-stage">
        {activeStep === "overview" ? (
          <div className="review-presentation-overview">
            <div className="review-presentation-conclusion">
              <Text type="secondary">一句话结论</Text>
              <Title level={3}>{overviewConclusion}</Title>
            </div>
            <div className="review-presentation-facts">
              <div><span>攻击交易</span><strong className="text-mono">{shortHash(firstTransaction)}</strong></div>
              <div><span>攻击步骤</span><strong>{attackStages.length} 个</strong></div>
              <div><span>可追溯证据</span><strong>{review.evidence.length} 条</strong></div>
              <div><span>修复验证</span><Tag color={trust.color}>{trust.label}</Tag></div>
            </div>
          </div>
        ) : null}

        {activeStep === "attack" ? (
          <div className="review-presentation-attack">
            {attackStages.length ? (
              <>
                <div className="review-attack-track" role="tablist" aria-label="结构化攻击链">
                  {attackStages.map((stage, index) => (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeAttackStage === index}
                      className={activeAttackStage === index ? "active" : ""}
                      key={stage.key}
                      onClick={() => setActiveAttackStage(index)}
                    >
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <strong>{stage.title}</strong>
                    </button>
                  ))}
                </div>
                {selectedAttackStage ? (
                  <article className="review-attack-focus">
                    <div className="review-attack-focus-index">{String(activeAttackStage + 1).padStart(2, "0")}</div>
                    <div>
                      <Space size={8} wrap>
                        <Title level={3}>{selectedAttackStage.title}</Title>
                        {selectedAttackStage.transactionHash ? (
                          <Tag className="text-mono">{shortHash(selectedAttackStage.transactionHash)}</Tag>
                        ) : null}
                      </Space>
                      <Paragraph>{selectedAttackStage.description}</Paragraph>
                      <Text type="secondary">关联 {selectedAttackStage.evidenceCount} 条证据</Text>
                    </div>
                  </article>
                ) : null}
              </>
            ) : (
              <div className="review-presentation-empty">当前快照尚未生成结构化攻击链。</div>
            )}
          </div>
        ) : null}

        {activeStep === "root" ? (
          <div className="review-presentation-root">
            <div className="review-presentation-section-title">
              <Target size={22} />
              <div><Text type="secondary">漏洞为什么成立</Text><Title level={3}>根因定位</Title></div>
            </div>
            <div className="review-root-grid">
              {review.root_causes.slice(0, 3).map((claim, index) => (
                <article key={claim.id}>
                  <span>ROOT {String(index + 1).padStart(2, "0")}</span>
                  <Paragraph>
                    {index === 0 && curatedCase?.root_cause_zh
                      ? curatedCase.root_cause_zh
                      : compactNarrative(localized(claim.statement), 220)}
                  </Paragraph>
                  <div><Tag>{claim.evidence_refs.length} 条证据</Tag><Tag color="blue">{claim.confidence || "已提取"}</Tag></div>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {activeStep === "verification" ? (
          <div className="review-presentation-verification">
            <div className="review-verification-result">
              <CheckCircle2 size={32} />
              <div>
                <Text type="secondary">最终验证结论</Text>
                <Title level={3}>{trust.label}</Title>
                <Paragraph>{localized(verification.patch_summary)}</Paragraph>
              </div>
            </div>
            <div className="review-verification-metrics">
              <div><span>补丁编译</span><strong>{technicalLabel(verification.compile_status)}</strong></div>
              <div><span>攻击重放</span><strong>{technicalLabel(verification.replay_status)}</strong></div>
              <div><span>攻击阻断</span><strong>{verification.attack_blocked === true ? "是" : verification.attack_blocked === false ? "否" : "暂无工具结果"}</strong></div>
              <div><span>修复后收益</span><strong>{verification.profit_after || "未知"}</strong></div>
            </div>
          </div>
        ) : null}
      </main>

      <footer className="review-presentation-footer">
        <Button icon={<ArrowLeft size={15} />} disabled={stepIndex === 0} onClick={() => goToStep(-1)}>上一步</Button>
        <Text type="secondary">{stepIndex + 1} / {PRESENTATION_STEPS.length}</Text>
        <Button type="primary" disabled={stepIndex === PRESENTATION_STEPS.length - 1} onClick={() => goToStep(1)}>
          下一步 <ArrowRight size={15} />
        </Button>
      </footer>
    </section>
  );
};

export default ReviewPresentation;
