import React from "react";
import { Descriptions, Drawer, Empty, List, Space, Tag, Typography } from "antd";
import { Database, FileText, TerminalSquare, Wrench } from "lucide-react";
import { EvidenceItem } from "../types";

interface EvidenceDrawerProps {
  title: string;
  open: boolean;
  evidence: EvidenceItem[];
  onClose: () => void;
}

function getSourceIcon(source: EvidenceItem["source"]) {
  if (source === "tool") return <Wrench size={14} />;
  if (source === "transaction") return <Database size={14} />;
  if (source === "report") return <FileText size={14} />;
  return <TerminalSquare size={14} />;
}

function getConfidenceColor(confidence: EvidenceItem["confidence"]) {
  if (confidence === "high") return "success";
  if (confidence === "medium") return "warning";
  return "default";
}

const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ title, open, evidence, onClose }) => {
  return (
    <Drawer title={title} open={open} onClose={onClose} size="large" className="evidence-drawer">
      {evidence.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No linked evidence yet" />
      ) : (
        <List
          className="evidence-list"
          dataSource={evidence}
          renderItem={(item) => (
            <List.Item className="evidence-item">
              <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                <div className="evidence-item-head">
                  <Space size={8} wrap>
                    <span className="evidence-source-icon">{getSourceIcon(item.source)}</span>
                    <Typography.Text strong>{item.title}</Typography.Text>
                    <Tag>{item.source}</Tag>
                    <Tag color={getConfidenceColor(item.confidence)}>{item.confidence}</Tag>
                  </Space>
                </div>

                <Descriptions bordered size="small" column={1}>
                  {item.agent ? <Descriptions.Item label="Agent">{item.agent}</Descriptions.Item> : null}
                  {item.message_type ? <Descriptions.Item label="Type">{item.message_type}</Descriptions.Item> : null}
                  {item.timestamp ? <Descriptions.Item label="Time">{item.timestamp}</Descriptions.Item> : null}
                  {item.log_id ? (
                    <Descriptions.Item label="Log ID">
                      <Typography.Text copyable className="text-mono">
                        {item.log_id}
                      </Typography.Text>
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>

                <pre className="evidence-content">{item.content}</pre>
              </Space>
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
};

export default EvidenceDrawer;
