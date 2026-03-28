// src/components/AgentMonitorCard.tsx
import React, { useEffect, useRef } from 'react';
import { Card, Badge, Typography } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AgentProps {
  name: string;
  status: 'idle' | 'running' | 'error';
  logs: any[];
  span?: number; // 控制在 Grid 中的占比
}

const AgentMonitorCard: React.FC<AgentProps> = ({ name, status, logs, span = 1 }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <Card 
      size="small"
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{name}</span>
          <Badge status={status === 'running' ? 'processing' : 'default'} text={status.toUpperCase()} />
        </div>
      }
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, overflow: 'hidden', padding: '8px', backgroundColor: '#141414' }}
    >
      <div style={{ height: '300px', overflowY: 'auto', fontSize: '12px', color: '#ccc' }}>
        {logs.map((log, index) => (
          <div key={index} style={{ marginBottom: '8px', borderBottom: '1px solid #333' }}>
            <Typography.Text type="secondary" style={{ fontSize: '10px' }}>
              [{new Date(log.timestamp).toLocaleTimeString()}]
            </Typography.Text>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{log.message}</ReactMarkdown>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </Card>
  );
};