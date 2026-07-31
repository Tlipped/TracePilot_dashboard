import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  compact?: boolean;
}

function normalizeMarkdownControlMarkers(content: string) {
  let inCodeFence = false;

  return content
    .split(/\r?\n/)
    .map((line) => {
      if (/^\s*(?:```|~~~)/.test(line)) {
        inCodeFence = !inCodeFence;
        return line;
      }

      if (
        !inCodeFence
        && /^\s*>{3,}\s*(?:(?:REPLACE|END|PATCH|SEARCH|ORIGINAL|NEW|OLD)[\w -]*)?\s*$/i.test(line)
      ) {
        return `\`${line.trim()}\``;
      }

      return line;
    })
    .join("\n");
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, compact = false }) => {
  return (
    <div className={compact ? "markdown-content markdown-compact" : "markdown-content"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {normalizeMarkdownControlMarkers(content || "")}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
