import React, { useMemo } from "react";
import { Alert, Button, Card, Collapse, Empty, Result, Skeleton, Space, Tag, Typography } from "antd";
import { CheckCircle2, ExternalLink, FileWarning, RotateCcw, ShieldCheck } from "lucide-react";
import {
  CaseReviewClaim,
  CaseReviewEvidence,
  CaseReviewV1,
  LanguageMode,
  LocalizedText,
} from "../types";

const { Paragraph, Text, Title } = Typography;

interface TrustedCaseReviewProps {
  review: CaseReviewV1;
  language: LanguageMode;
  onOpenLegacyReport?: () => void;
}

function localized(value: LocalizedText | null | undefined, language: LanguageMode) {
  if (!value) return "";
  return language === "zh" ? value.zh || value.en : value.en || value.zh || "";
}

function shortHash(value?: string | null) {
  if (!value) return "";
  return value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

function trustPresentation(status: string) {
  if (status === "verified") return { color: "success", label: "工具已验证" };
  if (status === "reported_verified") return { color: "warning", label: "模型报告通过" };
  if (status === "reported_failed") return { color: "error", label: "模型报告未通过" };
  if (status === "source_linked") return { color: "processing", label: "已关联来源" };
  if (status === "evidence_supported") return { color: "processing", label: "有证据支持" };
  if (status === "not_run") return { color: "default", label: "尚未验证" };
  return { color: "default", label: "未经验证" };
}

function technicalStatusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === "passed") return "已通过";
  if (normalized === "blocked") return "攻击已阻断";
  if (normalized === "reverted") return "攻击已回滚";
  if (normalized === "failed") return "未通过";
  return "暂无工具结果";
}

function SourceText({
  value,
  language,
}: {
  value: LocalizedText;
  language: LanguageMode;
}) {
  const chinese = value.zh?.trim() ?? "";
  const english = value.en?.trim() ?? "";

  if (language === "zh" && chinese) {
    return (
      <>
        <Paragraph className="trusted-review-source-text">{chinese}</Paragraph>
        {english && english !== chinese && (
          <Collapse
            ghost
            size="small"
            items={[
              {
                key: "source",
                label: "查看英文事实原文",
                children: <Paragraph className="trusted-review-source-text">{english}</Paragraph>,
              },
            ]}
          />
        )}
      </>
    );
  }

  return (
    <>
      {language === "zh" && (
        <div className="trusted-source-meta">
          <Tag color="blue">英文事实原文</Tag>
          <Text type="secondary">暂未生成经校验的中文翻译，避免改写安全语义。</Text>
        </div>
      )}
      <Paragraph className="trusted-review-source-text">{english || chinese}</Paragraph>
    </>
  );
}

interface TrustedCaseReviewStateProps {
  loading: boolean;
  error?: string;
  hasLegacyReport: boolean;
  onRetry: () => void;
  onOpenLegacyReport: () => void;
}

export const TrustedCaseReviewState: React.FC<TrustedCaseReviewStateProps> = ({
  loading,
  error,
  hasLegacyReport,
  onRetry,
  onOpenLegacyReport,
}) => {
  if (loading) {
    return (
      <div className="trusted-case-review" aria-live="polite">
        <Card className="trusted-review-card">
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Space>
              <Skeleton.Avatar active size="large" shape="square" />
              <Skeleton.Input active size="large" />
            </Space>
            <Skeleton active paragraph={{ rows: 5 }} />
          </Space>
        </Card>
        <div className="trusted-review-grid">
          <Card className="trusted-review-card"><Skeleton active paragraph={{ rows: 4 }} /></Card>
          <Card className="trusted-review-card"><Skeleton active paragraph={{ rows: 4 }} /></Card>
        </div>
      </div>
    );
  }

  return (
    <Card className="trusted-review-card">
      <Result
        status={error ? "warning" : "info"}
        title={error ? "可信评审暂时不可用" : "可信评审尚未生成"}
        subTitle={
          error
            ? "原始报告仍然可用。你可以重试结构化接口，失败不会影响其他分析结果。"
            : "任务完成后，系统会自动组织结论、验证状态和证据索引。"
        }
        extra={[
          <Button
            key="retry"
            type="primary"
            icon={<RotateCcw size={14} />}
            onClick={onRetry}
          >
            重新生成
          </Button>,
          hasLegacyReport ? (
            <Button key="legacy" onClick={onOpenLegacyReport}>
              查看原始报告
            </Button>
          ) : null,
        ].filter(Boolean)}
      />
      {error && <Alert type="error" showIcon message="接口错误详情" description={error} />}
    </Card>
  );
};

function ClaimCard({
  title,
  claim,
  language,
  evidenceById,
}: {
  title: string;
  claim?: CaseReviewClaim | null;
  language: LanguageMode;
  evidenceById: Map<string, CaseReviewEvidence>;
}) {
  if (!claim) {
    return (
      <Card className="trusted-review-card" title={title}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前结果尚未提供该字段" />
      </Card>
    );
  }
  const trust = trustPresentation(claim.verification_status);
  return (
    <Card
      className="trusted-review-card"
      title={title}
      extra={<Tag color={trust.color}>{trust.label}</Tag>}
    >
      <SourceText value={claim.statement} language={language} />
      {claim.evidence_refs.length > 0 && (
        <Space size={[4, 6]} wrap>
          <Text type="secondary">关联证据：</Text>
          {claim.evidence_refs.map((ref) => (
            <Tag key={ref}>{evidenceById.has(ref) ? ref : `${ref}（缺失）`}</Tag>
          ))}
        </Space>
      )}
    </Card>
  );
}

const TrustedCaseReview: React.FC<TrustedCaseReviewProps> = ({
  review,
  language,
  onOpenLegacyReport,
}) => {
  const evidenceById = useMemo(
    () => new Map(review.evidence.map((item) => [item.id, item])),
    [review.evidence],
  );
  const verification = review.patch_verification;
  const verificationTrust = trustPresentation(verification.verification_status);
  const productBrief = review.task_status === "failed"
    ? "本次任务未正常完成，以下内容只用于故障排查，不应作为最终审计结论。"
    : `系统已整理 ${review.attack_stages.length} 个攻击阶段和 ${review.evidence.length} 条可追溯证据；补丁状态为“${verificationTrust.label}”。`;

  const evidenceItems = review.evidence.map((item) => ({
    key: item.id,
    label: (
      <Space size={8} wrap>
        <Tag color={item.generated_by === "tool" ? "green" : item.generated_by === "model" ? "gold" : "blue"}>
          {item.generated_by === "tool" ? "工具" : item.generated_by === "model" ? "模型" : "系统"}
        </Tag>
        <Text strong>{localized(item.title, language)}</Text>
        {item.transaction_hash && <Text code>{shortHash(item.transaction_hash)}</Text>}
      </Space>
    ),
    children: (
      <div className="trusted-evidence-content">
        <Paragraph>{item.content_excerpt || "暂无可展示内容"}</Paragraph>
        <Space size={[8, 6]} wrap>
          <Text type="secondary">来源：{item.source}</Text>
          {item.content_hash && <Text type="secondary">{shortHash(item.content_hash)}</Text>}
          {item.artifact_ref && <Text code>{item.artifact_ref}</Text>}
        </Space>
      </div>
    ),
  }));

  return (
    <div className="trusted-case-review">
      <section className="trusted-review-hero">
        <div>
          <Space size={10} align="center" wrap>
            <span className="trusted-review-icon"><ShieldCheck size={22} /></span>
            <Title level={3}>可信评审</Title>
            <Tag color="blue">CaseReview v{review.schema_version}</Tag>
            <Tag color={review.completeness === "complete" ? "success" : "warning"}>
              {review.completeness === "complete" ? "字段完整" : "历史数据适配"}
            </Tag>
          </Space>
          <Paragraph type="secondary">
            结论、证据与验证状态由后端统一生成。英文原文保留为事实源，中文只用于界面解释。
          </Paragraph>
        </div>
        {review.legacy_report_available && onOpenLegacyReport && (
          <Button icon={<ExternalLink size={14} />} onClick={onOpenLegacyReport}>
            查看原始报告
          </Button>
        )}
      </section>

      <section className="trusted-product-brief">
        <div>
          <Text type="secondary">面向评审的一句话结论</Text>
          <Title level={4}>{productBrief}</Title>
        </div>
        <div className="trusted-brief-metrics">
          <div><Text type="secondary">任务状态</Text><Text strong>{review.task_status === "completed" ? "分析完成" : review.task_status}</Text></div>
          <div><Text type="secondary">攻击阶段</Text><Text strong>{review.attack_stages.length}</Text></div>
          <div><Text type="secondary">证据条目</Text><Text strong>{review.evidence.length}</Text></div>
          <div><Text type="secondary">修复可信度</Text><Tag color={verificationTrust.color}>{verificationTrust.label}</Tag></div>
        </div>
      </section>

      {review.quality_warnings.length > 0 && (
        <Alert
          className="trusted-review-warning"
          type="warning"
          showIcon
          icon={<FileWarning size={18} />}
          message="可信度说明"
          description={
            <ul>
              {review.quality_warnings.map((warning, index) => (
                <li key={`${localized(warning, language)}-${index}`}>
                  {localized(warning, language)}
                </li>
              ))}
            </ul>
          }
        />
      )}

      <div className="trusted-review-grid">
        <ClaimCard
          title="核心结论"
          claim={review.executive_summary}
          language={language}
          evidenceById={evidenceById}
        />
        <ClaimCard
          title="根因定位"
          claim={review.root_causes[0]}
          language={language}
          evidenceById={evidenceById}
        />
      </div>

      <Card
        className="trusted-review-card"
        title="攻击路径"
        extra={<Tag>{review.attack_stages.length} 个已结构化阶段</Tag>}
      >
        {review.attack_stages.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="旧结果中未找到可定位的交易阶段" />
        ) : (
          <ol className="trusted-stage-list">
            {review.attack_stages.map((stage) => (
              <li key={`${stage.order}-${stage.transaction_hash || stage.title.en}`}>
                <div className="trusted-stage-marker">{stage.order}</div>
                <div>
                  <Space size={8} wrap>
                    <Text strong>{localized(stage.title, language)}</Text>
                    <Tag color={stage.status === "observed" ? "blue" : "default"}>
                      {stage.status === "observed" ? "链路已观测" : stage.status}
                    </Tag>
                    {stage.transaction_hash && <Text code>{shortHash(stage.transaction_hash)}</Text>}
                  </Space>
                  <Paragraph type="secondary">{localized(stage.description, language)}</Paragraph>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card
        className="trusted-review-card trusted-verification-card"
        title="补丁与验证"
        extra={<Tag color={verificationTrust.color}>{verificationTrust.label}</Tag>}
      >
        <div className="trusted-verification-metrics">
          <div><Text type="secondary">编译</Text><Text strong>{technicalStatusLabel(verification.compile_status)}</Text></div>
          <div><Text type="secondary">攻击重放</Text><Text strong>{technicalStatusLabel(verification.replay_status)}</Text></div>
          <div>
            <Text type="secondary">攻击是否阻断</Text>
            <Text strong>
              {verification.attack_blocked === true ? "是" : verification.attack_blocked === false ? "否" : "无工具证据"}
            </Text>
          </div>
          <div><Text type="secondary">修复后收益</Text><Text strong>{verification.profit_after || "未知"}</Text></div>
        </div>
        {verification.patch_summary && (
          <SourceText value={verification.patch_summary} language={language} />
        )}
        {verification.verification_status === "verified" ? (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircle2 size={18} />}
            message="已通过服务端可信门禁"
          />
        ) : (
          <Alert
            type="info"
            showIcon
            message="这不是工具验证结论"
            description={verification.limitations.map((item) => localized(item, language)).join(" ")}
          />
        )}
      </Card>

      <Card
        className="trusted-review-card"
        title="证据索引"
        extra={<Tag color="blue">{review.evidence.length} 条</Tag>}
      >
        {evidenceItems.length > 0 ? (
          <Collapse ghost items={evidenceItems} />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可追溯证据" />
        )}
      </Card>
    </div>
  );
};

export default TrustedCaseReview;
