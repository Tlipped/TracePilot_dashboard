





// import React, { useEffect, useState, useRef } from 'react';
// import { useParams } from 'react-router-dom';
// import { Row, Col, Layout, Typography, Badge, Card, Empty, Space, Alert } from 'antd';
// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
// import { LogMessage, MsgType, LogLevel } from '../types';

// const { Header, Content } = Layout;

// const AGENT_CONFIGS = [
//   // 第一排：核心管理三剑客 (占位大 8/24)
//   { name: 'GlobalMemory Administrator', span: 8, color: '#1890ff' },
//   { name: 'Task Organizer', span: 8, color: '#fa8c16' },
//   { name: 'Transaction Debugger', span: 8, color: '#52c41a' },

//   // 第二排：流程执行智能体 (占位中 6/24)
//   { name: 'Transaction Filter', span: 6, color: '#722ed1' }, // 修正名字
//   { name: 'Code Patcher', span: 6, color: '#eb2f96' },       // 修正名字
//   { name: 'Transaction Judge', span: 6, color: '#2f54eb' },  // 修正名字
//   { name: 'TxDetailAgent', span: 6, color: '#13c2c2' },

//   // 第三排：底层分析智能体 (占位宽 12/24)
//   { name: 'TxFaultAgent', span: 12, color: '#faad14' },
//   { name: 'TxRoleAgent', span: 12, color: '#a0d911' },
// ];

// const Dashboard: React.FC = () => {
//   const { taskId } = useParams<{ taskId: string }>();
//   const [agentLogs, setAgentLogs] = useState<Record<string, LogMessage[]>>({});
//   const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
//   const [errorMsg, setErrorMsg] = useState<string>('');
//   const ws = useRef<WebSocket | null>(null);
//   const reconnectAttempts = useRef(0);
//   const maxReconnectAttempts = 10;
//   const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
//   const isReconnecting = useRef(false);

//   useEffect(() => {
//     connectWebSocket();
//     return () => {
//       if (reconnectTimeoutRef.current) {
//         clearTimeout(reconnectTimeoutRef.current);
//       }
//       if (ws.current) {
//         ws.current.close();
//       }
//     };
//   }, [taskId]);

//   const connectWebSocket = () => {
//     // ✅ 防止重复连接
//     if (isReconnecting.current || (ws.current && ws.current.readyState === WebSocket.OPEN)) {
//       return;
//     }

//     if (reconnectAttempts.current >= maxReconnectAttempts) {
//       setErrorMsg('Max reconnection attempts reached. Please refresh the page.');
//       setWsStatus('closed');
//       return;
//     }

//     isReconnecting.current = true;
//     setWsStatus('connecting');

//     try {
//       const wsUrl = `ws://127.0.0.1:8000/ws/${taskId}`;
//       ws.current = new WebSocket(wsUrl);

//       ws.current.onopen = () => {
//         console.log('✅ WebSocket connected');
//         setWsStatus('open');
//         setErrorMsg('');
//         reconnectAttempts.current = 0;
//         isReconnecting.current = false;
//       };

//       ws.current.onmessage = (event) => {
//         try {
//           const data = JSON.parse(event.data);
          
//           // 忽略系统消息
//           if (data.type === 'CONNECTED' || data.type === 'PING') {
//             return;
//           }
          
//           // 这是日志消息，必须包含 agent 和 message_type
//           if (data.agent && data.message_type && data.level && data.message) {
//             const logMsg: LogMessage = {
//               agent: data.agent,
//               level: data.level,
//               message: data.message,
//               message_type: data.message_type,
//               is_truncated: data.is_truncated || false,
//               timestamp: data.timestamp || new Date().toISOString(),
//               log_id: data.log_id
//             };
            
//             setAgentLogs((prev) => ({
//               ...prev,
//               [logMsg.agent]: [...(prev[logMsg.agent] || []), logMsg]
//             }));
//           }
//         } catch (e) {
//           console.error('Parse error:', e);
//         }
//       };

//       ws.current.onerror = (error) => {
//         console.error('❌ WebSocket error:', error);
//         setErrorMsg('WebSocket connection error');
//         setWsStatus('closed');
//         isReconnecting.current = false;
//       };

//       ws.current.onclose = (event) => {
//         console.log('❌ WebSocket closed, code:', event.code, 'reason:', event.reason);
//         setWsStatus('closed');
//         isReconnecting.current = false;
        
//         // ✅ 指数退避重连，初始延迟 2 秒
//         if (reconnectAttempts.current < maxReconnectAttempts) {
//           reconnectAttempts.current++;
//           const delay = Math.min(2000 * Math.pow(1.5, reconnectAttempts.current - 1), 30000); // 最大 30 秒
//           console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
//           reconnectTimeoutRef.current = setTimeout(() => {
//             connectWebSocket();
//           }, delay);
//         }
//       };
//     } catch (error) {
//       console.error('Failed to connect:', error);
//       setErrorMsg(`Connection failed: ${error}`);
//       setWsStatus('closed');
//       isReconnecting.current = false;
//     }
//   };

//   return (
//     <Layout style={{ height: '100vh', background: '#000', overflow: 'hidden' }}>
//       <Header style={{ 
//         background: '#141414', 
//         padding: '0 24px', 
//         display: 'flex', 
//         justifyContent: 'space-between', 
//         alignItems: 'center',
//         borderBottom: '1px solid #333'
//       }}>
//         <Space>
//           <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
//             TracePilot Monitor
//           </Typography.Title>
//           <Typography.Text type="secondary">
//             Task: {taskId?.substring(0, 8)}...
//           </Typography.Text>
//         </Space>
//         <Badge 
//           status={wsStatus === 'open' ? 'processing' : wsStatus === 'connecting' ? 'default' : 'error'} 
//           text={wsStatus.toUpperCase()} 
//           style={{ color: '#fff' }} 
//         />
//       </Header>
      
//       <Content style={{ padding: '12px', height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
//         {errorMsg && (
//           <Alert 
//             message={errorMsg} 
//             type="error" 
//             closable 
//             style={{ marginBottom: '12px' }}
//             onClose={() => setErrorMsg('')}
//           />
//         )}
        
//         <Row gutter={[12, 12]}>
//           {AGENT_CONFIGS.map((config) => (
//             <Col key={config.name} span={config.span}>
//               <AgentMonitorBox 
//                 config={config} 
//                 logs={agentLogs[config.name] || []} 
//               />
//             </Col>
//           ))}
//         </Row>
//       </Content>
//     </Layout>
//   );
// };

// interface AgentMonitorBoxProps {
//   config: {
//     name: string;
//     span: number;
//     color: string;
//   };
//   logs: LogMessage[];
// }

// const AgentMonitorBox: React.FC<AgentMonitorBoxProps> = ({ config, logs }) => {
//   const scrollRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (scrollRef.current) {
//       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
//     }
//   }, [logs]);

//   // 根据消息类型和级别返回样式
//   const getMessageStyle = (log: LogMessage) => {
//     const baseStyle = {
//       marginBottom: '8px',
//       padding: '8px',
//       borderRadius: '4px',
//       borderLeft: '3px solid',
//       fontSize: '12px',
//       fontFamily: "'Menlo', 'Monaco', 'Consolas', monospace",
//       whiteSpace: 'pre-wrap' as const,
//       wordBreak: 'break-all' as const,
//     };

//     // 根据级别设置颜色
//     const levelColors = {
//       [LogLevel.INFO]: { color: '#52c41a', bg: '#162312' },
//       [LogLevel.WARNING]: { color: '#faad14', bg: '#2b2011' },
//       [LogLevel.ERROR]: { color: '#ff4d4f', bg: '#2a1215' },
//       [LogLevel.DEBUG]: { color: '#1890ff', bg: '#111a2e' },
//     };

//     const levelStyle = levelColors[log.level] || levelColors[LogLevel.INFO];

//     // 根据消息类型调整背景
//     const msgTypeAdjust = {
//       [MsgType.MARKDOWN]: { bg: '#1a2a3a' },
//       [MsgType.TEXT]: { bg: '#141414' },
//       [MsgType.TOOL_CALL]: { bg: '#2b2011' },
//       [MsgType.RESULT]: { bg: '#112a11' },
//     };

//     const typeAdjust = msgTypeAdjust[log.message_type] || {};

//     return {
//       ...baseStyle,
//       borderLeftColor: levelStyle.color,
//       background: typeAdjust.bg || levelStyle.bg,
//       opacity: log.is_truncated ? 0.7 : 1,
//     };
//   };

//   const getLevelEmoji = (level: LogLevel) => {
//     const emojis = {
//       [LogLevel.INFO]: 'ℹ️',
//       [LogLevel.ERROR]: '❌',
//       [LogLevel.WARNING]: '⚠️',
//       [LogLevel.DEBUG]: '🐛',
//     };
//     return emojis[level] || '📝';
//   };

//   const getMsgTypeLabel = (msgType: MsgType) => {
//     const labels = {
//       [MsgType.MARKDOWN]: '📄',
//       [MsgType.TEXT]: '💬',
//       [MsgType.TOOL_CALL]: '🛠️',
//       [MsgType.RESULT]: '✅',
//     };
//     return labels[msgType] || '📝';
//   };

//   return (
//     <Card 
//       title={<span style={{ color: config.color, fontSize: '14px' }}>● {config.name}</span>}
//       size="small"
//       style={{ background: '#141414', border: '1px solid #333', borderRadius: '4px', height: '100%' }}
//       styles={{ body: { padding: '8px', height: '350px', overflow: 'hidden' } }}
//     >
//       <div 
//         ref={scrollRef}
//         style={{ height: '100%', overflowY: 'auto', paddingRight: '4px' }}
//         className="custom-scrollbar"
//       >
//         {logs.length === 0 ? (
//           <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Idle" />
//         ) : (
//           logs.map((log, i) => (
//             <div 
//               key={`${log.timestamp}-${i}`}
//               style={getMessageStyle(log)}
//             >
//               {/* 日志头部：时间戳和消息类型 */}
//               <div style={{ 
//                 display: 'flex', 
//                 justifyContent: 'space-between', 
//                 fontSize: '10px', 
//                 opacity: 0.6,
//                 marginBottom: '4px',
//                 color: '#999'
//               }}>
//                 <span>
//                   {getLevelEmoji(log.level)} {log.level} {getMsgTypeLabel(log.message_type)}
//                 </span>
//                 <span>
//                   {new Date(log.timestamp).toLocaleTimeString('en-US', {
//                     hour12: false,
//                     hour: '2-digit',
//                     minute: '2-digit',
//                     second: '2-digit'
//                   })}
//                 </span>
//               </div>
              
//               {/* 消息内容 */}
//               <div className="markdown-content" style={{ color: '#e8e8e8', lineHeight: '1.5' }}>
//                 {log.message_type === MsgType.MARKDOWN ? (
//                   <ReactMarkdown remarkPlugins={[remarkGfm]}>
//                     {log.message}
//                   </ReactMarkdown>
//                 ) : (
//                   <pre style={{ margin: 0, fontFamily: 'inherit' }}>
//                     {log.message}
//                   </pre>
//                 )}
//               </div>

//               {/* 截断提示 */}
//               {log.is_truncated && (
//                 <div style={{ 
//                   fontSize: '10px', 
//                   color: '#faad14',
//                   marginTop: '4px',
//                   fontStyle: 'italic'
//                 }}>
//                   [Content truncated...]
//                 </div>
//               )}
//             </div>
//           ))
//         )}
//       </div>
//     </Card>
//   );
// };

// export default Dashboard;
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Row, Col, Layout, Typography, Badge, Card, Empty, Space, Alert } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LogMessage, MsgType, LogLevel } from '../types';
import WebSocketService, { WebSocketMessage } from '../services/WebSocketService';

const { Header, Content } = Layout;

const AGENT_CONFIGS = [
  // 第一排：核心管理三剑客 (占位大 8/24)
  { name: 'GlobalMemory Administrator', span: 8, color: '#1890ff' },
  { name: 'Task Organizer', span: 8, color: '#fa8c16' },
  { name: 'Transaction Debugger', span: 8, color: '#52c41a' },

  // 第二排：流程执行智能体 (占位中 6/24)
  { name: 'Transaction Filter', span: 6, color: '#722ed1' }, // 修正名字
  { name: 'Code Patcher', span: 6, color: '#eb2f96' },       // 修正名字
  { name: 'Transaction Judge', span: 6, color: '#2f54eb' },  // 修正名字
  { name: 'TxDetailAgent', span: 6, color: '#13c2c2' },

  // 第三排：底层分析智能体 (占位宽 12/24)
  { name: 'TxFaultAgent', span: 12, color: '#faad14' },
  { name: 'TxRoleAgent', span: 12, color: '#a0d911' },
];

const Dashboard: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [agentLogs, setAgentLogs] = useState<Record<string, LogMessage[]>>({});  
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const mountedRef = useRef(true);

  useEffect(() => {
    // 当组件挂载时连接WebSocket
    const handleConnect = () => {
      setWsStatus('open');
      setErrorMsg('');
    };

    const handleError = (error: string) => {
      setErrorMsg(error);
      setWsStatus('closed');
    };

    WebSocketService.connect(taskId!, handleConnect, handleError);

    // 监听WebSocket消息
    const handleMessage = (data: WebSocketMessage) => {
      if (!mountedRef.current) return;
      
       setAgentLogs(prev => {
        // 确保数据符合LogMessage类型
        const newLog: LogMessage = {
          agent: data.agent,
          level: data.level as LogLevel,  // 强制转换为LogLevel类型
          message: data.message,
          message_type: data.message_type as MsgType,  // 强制转换为MsgType类型
          is_truncated: data.is_truncated || false,
          timestamp: data.timestamp || new Date().toISOString(),
          log_id: data.log_id
        };

        return {
          ...prev,
          [data.agent]: [...(prev[data.agent] || []), newLog]
        };
      });
    };

    WebSocketService.subscribe(handleMessage);

    // 更新连接状态
    const updateWsStatus = () => {
      if (!mountedRef.current) return;
      
      const state = WebSocketService.getConnectionState();
      if (state === WebSocket.OPEN) {
        setWsStatus('open');
      } else if (state === WebSocket.CONNECTING) {
        setWsStatus('connecting');
      } else {
        setWsStatus('closed');
      }
    };

    // 定期检查连接状态
    const statusInterval = setInterval(updateWsStatus, 1000);
    updateWsStatus(); // 初始检查

    return () => {
      mountedRef.current = false;
      // 注意：这里不再断开连接，而是让WebSocket在后台继续运行
      WebSocketService.unsubscribe(handleMessage);
      clearInterval(statusInterval);
    };
  }, [taskId]);

  return (
    <Layout style={{ height: '100vh', background: '#000', overflow: 'hidden' }}>
      <Header style={{ 
        background: '#141414', 
        padding: '0 24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderBottom: '1px solid #333'
      }}>
        <Space>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            TracePilot Monitor
          </Typography.Title>
          <Typography.Text type="secondary">
            Task: {taskId?.substring(0, 8)}...
          </Typography.Text>
        </Space>
        <Badge 
          status={wsStatus === 'open' ? 'processing' : wsStatus === 'connecting' ? 'default' : 'error'} 
          text={wsStatus.toUpperCase()} 
          style={{ color: '#fff' }} 
        />
      </Header>
      
      <Content style={{ padding: '12px', height: 'calc(100vh - 64px)', overflowY: 'auto' }}>
        {errorMsg && (
          <Alert 
            message={errorMsg} 
            type="error" 
            closable 
            style={{ marginBottom: '12px' }}
            onClose={() => setErrorMsg('')}
          />
        )}
        
        <Row gutter={[12, 12]}>
          {AGENT_CONFIGS.map((config) => (
            <Col key={config.name} span={config.span}>
              <AgentMonitorBox 
                config={config} 
                logs={agentLogs[config.name] || []} 
              />
            </Col>
          ))}
        </Row>
      </Content>
    </Layout>
  );
};

interface AgentMonitorBoxProps {
  config: {
    name: string;
    span: number;
    color: string;
  };
  logs: LogMessage[];
}

const AgentMonitorBox: React.FC<AgentMonitorBoxProps> = ({ config, logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // 根据消息类型和级别返回样式
  const getMessageStyle = (log: LogMessage) => {
    const baseStyle = {
      marginBottom: '8px',
      padding: '8px',
      borderRadius: '4px',
      borderLeft: '3px solid',
      fontSize: '12px',
      fontFamily: "'Menlo', 'Monaco', 'Consolas', monospace",
      whiteSpace: 'pre-wrap' as const,
      wordBreak: 'break-all' as const,
    };

    // 根据级别设置颜色
    const levelColors = {
      [LogLevel.INFO]: { color: '#52c41a', bg: '#162312' },
      [LogLevel.WARNING]: { color: '#faad14', bg: '#2b2011' },
      [LogLevel.ERROR]: { color: '#ff4d4f', bg: '#2a1215' },
      [LogLevel.DEBUG]: { color: '#1890ff', bg: '#111a2e' },
    };

    const levelStyle = levelColors[log.level] || levelColors[LogLevel.INFO];

    // 根据消息类型调整背景
    const msgTypeAdjust = {
      [MsgType.MARKDOWN]: { bg: '#1a2a3a' },
      [MsgType.TEXT]: { bg: '#141414' },
      [MsgType.TOOL_CALL]: { bg: '#2b2011' },
      [MsgType.RESULT]: { bg: '#112a11' },
    };

    const typeAdjust = msgTypeAdjust[log.message_type] || {};

    return {
      ...baseStyle,
      borderLeftColor: levelStyle.color,
      background: typeAdjust.bg || levelStyle.bg,
      opacity: log.is_truncated ? 0.7 : 1,
    };
  };

  const getLevelEmoji = (level: LogLevel) => {
    const emojis = {
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.ERROR]: '❌',
      [LogLevel.WARNING]: '⚠️',
      [LogLevel.DEBUG]: '🐛',
    };
    return emojis[level] || '📝';
  };

  const getMsgTypeLabel = (msgType: MsgType) => {
    const labels = {
      [MsgType.MARKDOWN]: '📄',
      [MsgType.TEXT]: '💬',
      [MsgType.TOOL_CALL]: '🛠️',
      [MsgType.RESULT]: '✅',
    };
    return labels[msgType] || '📝';
  };

  return (
    <Card 
      title={<span style={{ color: config.color, fontSize: '14px' }}>● {config.name}</span>}
      size="small"
      style={{ background: '#141414', border: '1px solid #333', borderRadius: '4px', height: '100%' }}
      styles={{ body: { padding: '8px', height: '350px', overflow: 'hidden' } }}
    >
      <div 
        ref={scrollRef}
        style={{ height: '100%', overflowY: 'auto', paddingRight: '4px' }}
        className="custom-scrollbar"
      >
        {logs.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Idle" />
        ) : (
          logs.map((log, i) => (
            <div 
              key={`${log.timestamp}-${i}`}
              style={getMessageStyle(log)}
            >
              {/* 日志头部：时间戳和消息类型 */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '10px', 
                opacity: 0.6,
                marginBottom: '4px',
                color: '#999'
              }}>
                <span>
                  {getLevelEmoji(log.level)} {log.level} {getMsgTypeLabel(log.message_type)}
                </span>
                <span>
                  {new Date(log.timestamp).toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>
              
              {/* 消息内容 */}
              <div className="markdown-content" style={{ color: '#e8e8e8', lineHeight: '1.5' }}>
                {log.message_type === MsgType.MARKDOWN ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {log.message}
                  </ReactMarkdown>
                ) : (
                  <pre style={{ margin: 0, fontFamily: 'inherit' }}>
                    {log.message}
                  </pre>
                )}
              </div>

              {/* 截断提示 */}
              {log.is_truncated && (
                <div style={{ 
                  fontSize: '10px', 
                  color: '#faad14',
                  marginTop: '4px',
                  fontStyle: 'italic'
                }}>
                  [Content truncated...]
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default Dashboard;