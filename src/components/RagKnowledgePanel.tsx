import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Empty, Input, Space, Tag, Typography } from "antd";
import { BookOpen, Database, Search, Sparkles } from "lucide-react";
import { searchRagKnowledge } from "../services/api";
import { RagSearchItem } from "../types";

interface RagKnowledgePanelProps {
  defaultQuery?: string;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

function sourceLabel(source: string) {
  if (source === "vulnerability_type") return "漏洞类型";
  if (source === "curated_case") return "精选案例";
  if (source === "generated_case") return "案例索引";
  return source || "知识片段";
}

function previewText(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

const quickPrompts = ["oracle manipulation flash loan", "delegatecall storage owner", "reentrancy withdraw trace"];

const RagKnowledgePanel: React.FC<RagKnowledgePanelProps> = ({
  defaultQuery = "",
  title = "相似案例召回",
  subtitle = "从漏洞知识库、真实案例和复现材料中检索相似攻击模式，给取证分析提供参考上下文。",
  compact = false,
}) => {
  const [query, setQuery] = useState(defaultQuery);
  const [items, setItems] = useState<RagSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const nextQuery = defaultQuery.trim();
    setQuery(defaultQuery);
    if (!nextQuery) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setSearched(true);
    searchRagKnowledge({ query: nextQuery, top_k: compact ? 3 : 5 })
      .then((response) => {
        if (cancelled) return;
        setItems(response.items || []);
        setTotal(response.total || 0);
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
        setError(detail || "知识库检索暂时不可用，请检查后端 RAG 索引。");
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [compact, defaultQuery]);

  const topItems = useMemo(() => items.slice(0, compact ? 3 : 5), [compact, items]);

  const runSearch = useCallback(async (value = query) => {
    const nextQuery = value.trim();
    if (!nextQuery || loading) return;
    setQuery(nextQuery);
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const response = await searchRagKnowledge({ query: nextQuery, top_k: compact ? 3 : 5 });
      setItems(response.items || []);
      setTotal(response.total || 0);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(detail || "知识库检索暂时不可用，请检查后端 RAG 索引。");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [compact, loading, query]);

  return (
    <section className={`rag-knowledge-panel${compact ? " rag-knowledge-panel-compact" : ""}`}>
      <div className="rag-panel-header">
        <Space size={8}>
          <span className="rag-panel-icon"><Sparkles size={17} /></span>
          <div>
            <Typography.Text strong>{title}</Typography.Text>
            <Typography.Paragraph>{subtitle}</Typography.Paragraph>
          </div>
        </Space>
        <Tag icon={<Database size={13} />}>RAG</Tag>
      </div>

      <div className="rag-search-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onPressEnter={() => runSearch()}
          placeholder="输入漏洞类型、函数名、攻击现象或交易描述"
          allowClear
        />
        <Button type="primary" icon={<Search size={15} />} loading={loading} onClick={() => runSearch()}>
          检索
        </Button>
      </div>

      <div className="rag-prompt-row">
        {quickPrompts.map((prompt) => (
          <button key={prompt} type="button" onClick={() => runSearch(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <div className="rag-result-list">
        {topItems.length ? (
          <>
            <div className="rag-result-meta">
              <BookOpen size={14} />
              <span>召回 {topItems.length} 条，候选知识片段 {total} 条</span>
            </div>
            {topItems.map((item) => (
              <article className="rag-result-card" key={item.id}>
                <div className="rag-result-title">
                  <Tag>{sourceLabel(item.source)}</Tag>
                  <strong>{item.title}</strong>
                  <span>{Math.round(item.score * 100)}%</span>
                </div>
                <p>{previewText(item.content)}</p>
                {item.tags?.length ? (
                  <div className="rag-tag-row">
                    {item.tags.slice(0, 4).map((tag) => <Tag key={tag}>{tag}</Tag>)}
                  </div>
                ) : null}
              </article>
            ))}
          </>
        ) : searched && !loading && !error ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有召回相似知识片段" />
        ) : null}
      </div>
    </section>
  );
};

export default RagKnowledgePanel;
