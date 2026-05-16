import React, { useMemo, useState } from "react";
import { Button, Descriptions, Drawer, Empty, List, Space, Tag, Typography } from "antd";
import { ExternalLink, Info } from "lucide-react";

interface DappReference {
  time?: string;
  link?: string;
}

interface DappMetadata {
  name?: string;
  cause?: string;
  platform?: string;
  time?: string;
  transaction_hash?: string[];
  report?: string;
  detection?: DappReference;
  disclosure?: DappReference;
  root_cause?: string;
  report_link?: string;
}

const dappModules = import.meta.glob("../data/*.json", { eager: true, import: "default" }) as Record<
  string,
  DappMetadata
>;

const DAPP_CONTEXT_MAP = Object.fromEntries(
  Object.entries(dappModules).map(([path, data]) => {
    const fallbackName = path.split("/").pop()?.replace(/\.json$/, "") ?? "";
    return [data.name ?? fallbackName, data];
  }),
) as Record<string, DappMetadata>;

function shortHash(hash: string) {
  if (hash.length <= 18) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function openExternal(url?: string) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

interface Props {
  dappName?: string | null;
  size?: "small" | "middle" | "large";
  type?: "link" | "text" | "default" | "primary" | "dashed";
  disabled?: boolean;
}

const DappContextButton: React.FC<Props> = ({ dappName, size = "small", type = "default", disabled }) => {
  const [open, setOpen] = useState(false);
  const metadata = useMemo(() => (dappName ? DAPP_CONTEXT_MAP[dappName] : undefined), [dappName]);
  const title = metadata?.name ?? dappName ?? "DApp";
  const references = [
    { label: "Detection", ...metadata?.detection },
    { label: "Disclosure", ...metadata?.disclosure },
    { label: "Report", link: metadata?.report_link },
  ].filter((item) => item.link);

  return (
    <>
      <Button
        size={size}
        type={type}
        icon={<Info size={14} />}
        disabled={disabled || !dappName}
        onClick={() => setOpen(true)}
      >
        Context
      </Button>

      <Drawer
        title={`${title} Vulnerability Context`}
        open={open}
        onClose={() => setOpen(false)}
        size="large"
        extra={
          <Space>
            {metadata?.platform ? <Tag>{metadata.platform}</Tag> : null}
            {metadata?.cause ? <Tag color="blue">{metadata.cause}</Tag> : null}
          </Space>
        }
      >
        {metadata ? (
          <Space orientation="vertical" size={18} style={{ width: "100%" }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Incident Time">{metadata.time ?? "N/A"}</Descriptions.Item>
              <Descriptions.Item label="Root Cause">{metadata.root_cause ?? "N/A"}</Descriptions.Item>
              <Descriptions.Item label="Platform">{metadata.platform ?? "N/A"}</Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Title level={5}>Background</Typography.Title>
              <Typography.Paragraph>{metadata.report ?? "No background report is available."}</Typography.Paragraph>
            </div>

            <div>
              <Typography.Title level={5}>Reference Links</Typography.Title>
              {references.length > 0 ? (
                <List
                  size="small"
                  dataSource={references}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button
                          key="open"
                          size="small"
                          type="link"
                          icon={<ExternalLink size={13} />}
                          onClick={() => openExternal(item.link)}
                        >
                          Open
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={item.label}
                        description={
                          <Space orientation="vertical" size={2}>
                            {item.time ? <Typography.Text type="secondary">{item.time}</Typography.Text> : null}
                            <Typography.Text copyable className="text-mono">
                              {item.link}
                            </Typography.Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No reference links" />
              )}
            </div>

            <div>
              <Typography.Title level={5}>Attack Transactions</Typography.Title>
              <List
                size="small"
                dataSource={metadata.transaction_hash ?? []}
                locale={{ emptyText: "No transaction hash" }}
                renderItem={(hash) => (
                  <List.Item>
                    <Typography.Text copyable={{ text: hash }} className="text-mono">
                      {shortHash(hash)}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            </div>
          </Space>
        ) : (
          <Empty description="No context metadata found for this DApp" />
        )}
      </Drawer>
    </>
  );
};

export default DappContextButton;
