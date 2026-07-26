import React, { useMemo } from "react";
import { Alert, Button, Card, Collapse, Empty, Space, Tag, Typography } from "antd";
import { CheckCircle2, ExternalLink, FileWarning, ShieldCheck } from "lucide-react";
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
      <Paragraph className="trusted-review-source-text">
        {localized(claim.statement, language)}
      </Paragraph>
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
          <div><Text type="secondary">编译</Text><Text strong>{verification.compile_status}</Text></div>
          <div><Text type="secondary">攻击重放</Text><Text strong>{verification.replay_status}</Text></div>
          <div>
            <Text type="secondary">攻击是否阻断</Text>
            <Text strong>
              {verification.attack_blocked === true ? "是" : verification.attack_blocked === false ? "否" : "无工具证据"}
            </Text>
          </div>
          <div><Text type="secondary">修复后收益</Text><Text strong>{verification.profit_after || "未知"}</Text></div>
        </div>
        {verification.patch_summary && (
          <Paragraph className="trusted-review-source-text">
            {localized(verification.patch_summary, language)}
          </Paragraph>
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
