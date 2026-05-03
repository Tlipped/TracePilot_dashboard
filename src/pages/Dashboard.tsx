import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Layout, Space, Spin, Tabs, Tag, Typography } from "antd";
import { Activity, ArrowLeft, Bot, FileText, FolderOpen, ListTree, RefreshCcw, Wifi, WifiOff } from "lucide-react";
import AgentNavigator, { AgentStats } from "../components/AgentNavigator";
import { AGENT_NAMES } from "../constants/agents";
import AgentFileLogs from "../components/AgentFileLogs";
import AgentInsights from "../components/AgentInsights";
import AgentTimeline from "../components/AgentTimeline";
import LogDetailDrawer from "../components/LogDetailDrawer";
import LogStream from "../components/LogStream";
import StructuredReport from "../components/StructuredReport";
import { getTask } from "../services/api";
import WebSocketService from "../services/WebSocketService";
import { LogLevel, LogMessage, Task, TaskEvent, TaskStatus } from "../types";

const { Header, Content } = Layout;

function isLogEvent(event: TaskEvent): event is LogMessage {
  return event.type === "LOG";
}

function formatDuration(duration?: number | null) {
  if (duration == null) return "N/A";
  if (duration < 60) return `${duration.toFixed(1)}s`;
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}m ${seconds}s`;
}

function getStatusColor(status?: TaskStatus) {
  if (status === TaskStatus.COMPLETED) return "success";
  if (status === TaskStatus.FAILED) return "error";
  if (status === TaskStatus.RUNNING) return "processing";
  return "default";
}

function isTerminalTask(status?: TaskStatus) {
  return status === TaskStatus.COMPLETED || status === TaskStatus.FAILED;
}

const Dashboard: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const mountedRef = useRef(true);
  const [task, setTask] = useState<Task | null>(null);
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | "all">("all");
  const [selectedLog, setSelectedLog] = useState<LogMessage | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState<WebSocket["readyState"] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingTask, setLoadingTask] = useState(true);

  const refreshTask = useCallback(async () => {
    if (!taskId) return;
    try {
      setLoadingTask(true);
      const nextTask = await getTask(taskId);
      setTask(nextTask);
      setErrorMsg("");
    } catch {
      setErrorMsg("Failed to fetch task status.");
    } finally {
      setLoadingTask(false);
    }
  }, [taskId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!taskId) return;

    refreshTask();
    setEvents(WebSocketService.getHistory());

    const handleConnect = () => {
      setErrorMsg("");
      setWsStatus(WebSocket.OPEN);
    };

    const handleError = (error: string) => {
      setErrorMsg(error);
      setWsStatus(WebSocket.CLOSED);
    };

    const handleStatus = (status: WebSocket["readyState"] | null) => {
      if (mountedRef.current) setWsStatus(status);
    };

    const handleEvent = (event: TaskEvent) => {
      if (!mountedRef.current) return;
      setEvents((prev) => [...prev, event].slice(-5000));

      if (event.type === "TASK_STATUS") {
        setTask((prev) => ({
          task_id: event.task_id,
          dapp_name: event.dapp_name,
          status: event.status,
          created_at: event.created_at ?? prev?.created_at ?? "",
          completed_at: event.completed_at,
          duration: event.duration,
          final_report: prev?.final_report,
          result: prev?.result,
          error: event.error,
          archived: event.archived ?? prev?.archived ?? false,
        }));
      }

      if (event.type === "TASK_FINAL") {
        setTask((prev) => ({
          task_id: event.task_id,
          dapp_name: event.dapp_name,
          status: event.status,
          created_at: prev?.created_at ?? "",
          completed_at: event.completed_at,
          duration: event.duration,
          final_report: event.final_report,
          result: prev?.result,
          error: event.error,
          archived: event.archived ?? prev?.archived ?? false,
        }));
      }
    };

    WebSocketService.subscribe(handleEvent);
    WebSocketService.subscribeStatus(handleStatus);
    WebSocketService.connect(taskId, handleConnect, handleError);
    setWsStatus(WebSocketService.getConnectionState());

    return () => {
      mountedRef.current = false;
      WebSocketService.unsubscribe(handleEvent);
      WebSocketService.unsubscribeStatus(handleStatus);
    };
  }, [refreshTask, taskId]);

  const agentStats = useMemo<AgentStats[]>(() => {
    const map = new Map<string, AgentStats>();
    AGENT_NAMES.forEach((name) => map.set(name, { name, total: 0, errors: 0, warnings: 0 }));

    events.forEach((event) => {
      if (!isLogEvent(event)) return;
      const current = map.get(event.agent) ?? { name: event.agent, total: 0, errors: 0, warnings: 0 };
      current.total += 1;
      current.lastSeen = event.timestamp;
      current.lastLevel = event.level;
      if (event.level === LogLevel.ERROR) current.errors += 1;
      if (event.level === LogLevel.WARNING) current.warnings += 1;
      map.set(event.agent, current);
    });

    return Array.from(map.values());
  }, [events]);

  const totalLogs = events.filter(isLogEvent).length;
  const wsOpen = wsStatus === WebSocket.OPEN;
  const terminalTask = isTerminalTask(task?.status);
  const connectionLabel = wsOpen ? "live" : terminalTask ? "archived" : "offline";
  const connectionColor = wsOpen ? "success" : terminalTask ? "default" : "error";

  const openLog = (log: LogMessage) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  return (
    <Layout className="app-shell">
      <Header className="topbar">
        <Space size={12}>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/")} />
          <div>
            <Typography.Title level={5} style={{ margin: 0 }}>
              TracePilot Analysis
            </Typography.Title>
            <Typography.Text type="secondary" className="text-mono">
              {taskId?.slice(0, 8)}...
            </Typography.Text>
          </div>
        </Space>
        <Space size={10}>
          <Tag color={getStatusColor(task?.status)}>{task?.status ?? "loading"}</Tag>
          {task?.archived ? <Tag>archived</Tag> : null}
          <Tag>{task?.dapp_name ?? "Unknown DApp"}</Tag>
          <Tag>{formatDuration(task?.duration)}</Tag>
          <Tag icon={wsOpen ? <Wifi size={13} /> : <WifiOff size={13} />} color={connectionColor}>
            {connectionLabel}
          </Tag>
          <Button icon={<RefreshCcw size={15} />} onClick={refreshTask}>
            Refresh
          </Button>
        </Space>
      </Header>

      <Content className="dashboard-layout">
        {errorMsg ? <Alert type="error" showIcon message={errorMsg} closable onClose={() => setErrorMsg("")} /> : null}

        <div className="task-overview">
          <div>
            <Typography.Text type="secondary">DApp</Typography.Text>
            <Typography.Title level={4}>{task?.dapp_name ?? "Loading..."}</Typography.Title>
          </div>
          <div className="overview-metrics">
            <div>
              <span className="metric-value">{totalLogs}</span>
              <span className="metric-label">logs</span>
            </div>
            <div>
              <span className="metric-value">{agentStats.filter((item) => item.total > 0).length}</span>
              <span className="metric-label">agents</span>
            </div>
            <div>
              <span className="metric-value">{formatDuration(task?.duration)}</span>
              <span className="metric-label">duration</span>
            </div>
          </div>
        </div>

        {loadingTask && !task ? (
          <div className="center-loading">
            <Spin />
          </div>
        ) : (
          <div className="workbench-grid">
            <AgentNavigator stats={agentStats} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />

            <div className="analysis-center">
              <Tabs
                defaultActiveKey="stream"
                items={[
                  {
                    key: "stream",
                    label: (
                      <Space size={6}>
                        <Activity size={14} />
                        Log Stream
                      </Space>
                    ),
                    children: <LogStream events={events} selectedAgent={selectedAgent} onSelectLog={openLog} />,
                  },
                  {
                    key: "timeline",
                    label: (
                      <Space size={6}>
                        <ListTree size={14} />
                        Timeline
                      </Space>
                    ),
                    children: <AgentTimeline events={events} selectedAgent={selectedAgent} onSelectLog={openLog} />,
                  },
                ]}
              />
            </div>

            <aside className="inspector-panel">
              <Tabs
                defaultActiveKey="agents"
                items={[
                  {
                    key: "agents",
                    label: (
                      <Space size={6}>
                        <Bot size={14} />
                        Agent Brief
                      </Space>
                    ),
                    children: (
                      <AgentInsights
                        events={events}
                        selectedAgent={selectedAgent}
                        onSelectAgent={setSelectedAgent}
                        onSelectLog={openLog}
                      />
                    ),
                  },
                  {
                    key: "report",
                    label: (
                      <Space size={6}>
                        <FileText size={14} />
                        Final Report
                      </Space>
                    ),
                    children: <StructuredReport task={task} events={events} />,
                  },
                  {
                    key: "agent-files",
                    label: (
                      <Space size={6}>
                        <FolderOpen size={14} />
                        File Logs
                      </Space>
                    ),
                    children: <AgentFileLogs taskId={taskId ?? ""} />,
                  },
                  {
                    key: "summary",
                    label: "Task",
                    children: (
                      <div className="task-detail-list">
                        <div>
                          <span>Task ID</span>
                          <Typography.Text copyable className="text-mono">
                            {taskId}
                          </Typography.Text>
                        </div>
                        <div>
                          <span>Status</span>
                          <Space size={6}>
                            <Tag color={getStatusColor(task?.status)}>{task?.status}</Tag>
                            {task?.archived ? <Tag>archived</Tag> : null}
                          </Space>
                        </div>
                        <div>
                          <span>Created</span>
                          <Typography.Text>{task?.created_at ?? "N/A"}</Typography.Text>
                        </div>
                        <div>
                          <span>Completed</span>
                          <Typography.Text>{task?.completed_at ?? "N/A"}</Typography.Text>
                        </div>
                        <div>
                          <span>Error</span>
                          <Typography.Text type={task?.error ? "danger" : "secondary"}>
                            {task?.error ?? "None"}
                          </Typography.Text>
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            </aside>
          </div>
        )}
      </Content>

      <LogDetailDrawer
        taskId={taskId ?? ""}
        log={selectedLog}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </Layout>
  );
};

export default Dashboard;
