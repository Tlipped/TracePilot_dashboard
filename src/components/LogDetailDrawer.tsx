import React, { useEffect, useState } from "react";
import { App as AntdApp, Button, Descriptions, Drawer, Space, Tag, Typography } from "antd";
import { Copy, ExternalLink } from "lucide-react";
import { getFullLog } from "../services/api";
import { FullLogResponse, LogMessage, MsgType } from "../types";
import MarkdownRenderer from "./MarkdownRenderer";

interface LogDetailDrawerProps {
  taskId: string;
  log: LogMessage | null;
  open: boolean;
  onClose: () => void;
}

const LogDetailDrawer: React.FC<LogDetailDrawerProps> = ({ taskId, log, open, onClose }) => {
  const { message } = AntdApp.useApp();
  const [fullLog, setFullLog] = useState<FullLogResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFullLog(null);

    if (!open || !log?.log_id) return;

    setLoading(true);
    getFullLog(taskId, log.log_id)
      .then((data) => {
        if (!cancelled) setFullLog(data);
      })
      .catch(() => {
        if (!cancelled) message.warning("Full log is unavailable; showing streamed content.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [log?.log_id, message, open, taskId]);

  const content = fullLog?.content ?? log?.message ?? "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    message.success("Copied");
  };

  return (
    <Drawer
      title="Log Detail"
      open={open}
      onClose={onClose}
      size="large"
      className="log-detail-drawer"
      extra={
        <Space>
          {fullLog?.source ? <Tag>{fullLog.source}</Tag> : null}
          <Button icon={<Copy size={14} />} onClick={handleCopy}>
            Copy
          </Button>
        </Space>
      }
    >
      {!log ? null : (
        <Space orientation="vertical" size={16} style={{ width: "100%" }}>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Agent">{log.agent}</Descriptions.Item>
            <Descriptions.Item label="Level">{log.level}</Descriptions.Item>
            <Descriptions.Item label="Type">{log.message_type}</Descriptions.Item>
            <Descriptions.Item label="Timestamp">{log.timestamp}</Descriptions.Item>
            <Descriptions.Item label="Log ID">
              {log.log_id ? (
                <Typography.Text copyable className="text-mono">
                  {log.log_id}
                </Typography.Text>
              ) : (
                "N/A"
              )}
            </Descriptions.Item>
          </Descriptions>

          {loading ? (
            <Typography.Text type="secondary">Loading full log...</Typography.Text>
          ) : (
            <div className="log-detail-content">
              {log.message_type === MsgType.MARKDOWN || log.message_type === MsgType.RESULT ? (
                <MarkdownRenderer content={content} />
              ) : (
                <pre>{content}</pre>
              )}
            </div>
          )}

          {log.is_truncated ? (
            <div className="system-note">
              <ExternalLink size={14} />
              This streamed log was truncated. The drawer attempts to fetch full content by log_id.
            </div>
          ) : null}
        </Space>
      )}
    </Drawer>
  );
};

export default LogDetailDrawer;
