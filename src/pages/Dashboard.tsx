import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Layout, Segmented, Space, Spin, Tabs, Tag, Typography } from "antd";
import { Activity, ArrowLeft, Bot, FileText, FolderOpen, Home, ListTree, RefreshCcw, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import AgentNavigator, { AgentStats } from "../components/AgentNavigator";
import { AGENT_NAMES } from "../constants/agents";
import AgentFileLogs from "../components/AgentFileLogs";
import AgentConsistencyPanel from "../components/AgentConsistencyPanel";
import AgentInsights from "../components/AgentInsights";
import AgentTimeline from "../components/AgentTimeline";
import AttackReplayTimeline from "../components/AttackReplayTimeline";
import DappContextButton from "../components/DappContextButton";
import ForensicAssistantDrawer from "../components/ForensicAssistantDrawer";
import LogDetailDrawer from "../components/LogDetailDrawer";
import LogStream from "../components/LogStream";
import LearningGuidePanel from "../components/LearningGuidePanel";
import MacroAnalysisPanel from "../components/MacroAnalysisPanel";
import StructuredReport from "../components/StructuredReport";
import { getAutomatedReview, getMacroAnalysis, getTask, getTaskLogs } from "../services/api";
import WebSocketService from "../services/WebSocketService";
import {
  LanguageMode,
  LogLevel,
  LogMessage,
  AutomatedReviewResponse,
  MacroAnalysisResponse,
  ProductViewMode,
  Task,
  TaskEvent,
  TaskStatus,
} from "../types";
import { modeLabel, t } from "../utils/i18n";
import riskPilotLogo from "../assets/riskpilot_logo.png";

const { Header, Content } = Layout;

type MainTabItem = NonNullable<React.ComponentProps<typeof Tabs>["items"]>[number];

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

function getDefaultMainTab(mode: ProductViewMode) {
  if (mode === "learn") return "learning";
  if (mode === "auditor") return "macro";
  if (mode === "raw") return "stream";
  return "report";
}

const PERSISTED_LOG_PAGE_SIZE = 1000;
const MAX_PERSISTED_LOG_PAGES = 5;

async function fetchPersistedTaskEvents(taskId: string) {
  let cursor: number | null = null;
  let events: LogMessage[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PERSISTED_LOG_PAGES; pageIndex += 1) {
    const page = await getTaskLogs(taskId, { limit: PERSISTED_LOG_PAGE_SIZE, before_id: cursor });
    events = [...page.events, ...events];
    if (!page.has_more || !page.next_before_id) break;
    cursor = page.next_before_id;
  }

  return events;
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
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState<WebSocket["readyState"] | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingTask, setLoadingTask] = useState(true);
  const [viewMode, setViewMode] = useState<ProductViewMode>("report");
  const [language, setLanguage] = useState<LanguageMode>("zh");
  const [activeMainTab, setActiveMainTab] = useState(getDefaultMainTab("report"));
  const [macroAnalysis, setMacroAnalysis] = useState<MacroAnalysisResponse | null>(null);
  const [automatedReview, setAutomatedReview] = useState<AutomatedReviewResponse | null>(null);

  const refreshTask = useCallback(async () => {
    if (!taskId) return null;
    try {
      setLoadingTask(true);
      const nextTask = await getTask(taskId);
      setTask(nextTask);
      setErrorMsg("");
      return nextTask;
    } catch {
      setErrorMsg("Failed to fetch task status.");
      return null;
    } finally {
      setLoadingTask(false);
    }
  }, [taskId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!taskId) return;

    let cancelled = false;
    WebSocketService.disconnect();
    WebSocketService.clearHistory();
    setEvents([]);
    setWsStatus(null);

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

    const initializeTaskView = async () => {
      const nextTask = await refreshTask();
      if (cancelled || !mountedRef.current || !nextTask) return;

      if (isTerminalTask(nextTask.status)) {
        try {
          const persistedEvents = await fetchPersistedTaskEvents(taskId);
          if (!cancelled && mountedRef.current) {
            setEvents(persistedEvents);
            setWsStatus(null);
          }
        } catch {
          if (!cancelled && mountedRef.current) setErrorMsg("Failed to fetch persisted task logs. Please check /api/tasks/{task_id}/logs.");
        }
        return;
      }

      setEvents(WebSocketService.getHistory());
      WebSocketService.subscribe(handleEvent);
      WebSocketService.subscribeStatus(handleStatus);
      WebSocketService.connect(taskId, handleConnect, handleError);
      setWsStatus(WebSocketService.getConnectionState());
    };

    initializeTaskView();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      WebSocketService.unsubscribe(handleEvent);
      WebSocketService.unsubscribeStatus(handleStatus);
    };
  }, [refreshTask, taskId]);

  useEffect(() => {
    setActiveMainTab(getDefaultMainTab(viewMode));
  }, [viewMode]);

  useEffect(() => {
    let cancelled = false;
    if (!taskId) {
      setMacroAnalysis(null);
      return;
    }

    getMacroAnalysis(taskId)
      .then((payload) => {
        if (!cancelled) setMacroAnalysis(payload);
      })
      .catch(() => {
        if (!cancelled) setMacroAnalysis(null);
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, task?.status, task?.completed_at]);

  useEffect(() => {
    let cancelled = false;
    if (!taskId) {
      setAutomatedReview(null);
      return;
    }

    getAutomatedReview(taskId)
      .then((payload) => {
        if (!cancelled) setAutomatedReview(payload);
      })
      .catch(() => {
        if (!cancelled) setAutomatedReview(null);
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, task?.status, task?.completed_at]);

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
  const connectionLabel = wsOpen ? t(language, "live") : terminalTask ? t(language, "archived") : t(language, "offline");
  const connectionColor = wsOpen ? "success" : terminalTask ? "default" : "error";
  const activeAgentCount = agentStats.filter((item) => item.total > 0).length;
  const agentIssueCount = agentStats.filter((item) => item.errors > 0 || item.warnings > 0).length;
  const systemStatusLabel = task?.status === TaskStatus.RUNNING || wsOpen
    ? "运行中"
    : terminalTask
      ? "已完成"
      : "待连接";
  const systemStatusTone = agentIssueCount > 0 ? "warning" : task?.status === TaskStatus.FAILED ? "error" : "healthy";
  const systemStatusHint = agentIssueCount > 0
    ? `${agentIssueCount} 个 Agent 有告警或错误`
    : activeAgentCount > 0
      ? "所有 Agent 正常运行"
      : "等待 Agent 输出日志";

  const openLog = (log: LogMessage) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const mainTabItems = useMemo(() => {
    const reportTab: MainTabItem = {
      key: "report",
      label: (
        <Space size={6}>
          <FileText size={14} />
          {t(language, "reportTab")}
        </Space>
      ),
      children: (
        <StructuredReport
          task={task}
          events={events}
          mode={viewMode}
          macroAnalysis={macroAnalysis}
          automatedReview={automatedReview}
          language={language}
        />
      ),
    };

    const replayTab: MainTabItem = {
      key: "attack-replay",
      label: (
        <Space size={6}>
          <ListTree size={14} />
          {t(language, "replayTab")}
        </Space>
      ),
      children: <AttackReplayTimeline task={task} events={events} mode={viewMode} />,
    };

    const learningTab: MainTabItem = {
      key: "learning",
      label: (
        <Space size={6}>
          <Bot size={14} />
          {language === "zh" ? "学习导览" : "Learning Guide"}
        </Space>
      ),
      children: <LearningGuidePanel task={task} macro={macroAnalysis} language={language} />,
    };

    const macroTab: MainTabItem = {
      key: "macro",
      label: (
        <Space size={6}>
          <ShieldCheck size={14} />
          {t(language, "macroTab")}
        </Space>
      ),
      children: <MacroAnalysisPanel macro={macroAnalysis} language={language} />,
    };

    const consistencyTab: MainTabItem = {
      key: "consistency",
      label: (
        <Space size={6}>
          <ShieldCheck size={14} />
          {language === "zh" ? "一致性检查" : "Consistency"}
        </Space>
      ),
      children: (
        <AgentConsistencyPanel
          task={task}
          events={events}
          macro={macroAnalysis}
          review={automatedReview}
          language={language}
        />
      ),
    };

    const streamTab: MainTabItem = {
      key: "stream",
      label: (
        <Space size={6}>
          <Activity size={14} />
          {t(language, "rawLogsTab")}
        </Space>
      ),
      children: (
        <LogStream
          taskId={taskId}
          events={events}
          selectedAgent={selectedAgent}
          onSelectLog={openLog}
          rawMode
        />
      ),
    };

    const timelineTab: MainTabItem = {
      key: "timeline",
      label: (
        <Space size={6}>
          <ListTree size={14} />
          {t(language, "timelineTab")}
        </Space>
      ),
      children: <AgentTimeline events={events} selectedAgent={selectedAgent} onSelectLog={openLog} />,
    };

    const tabMap: Record<string, MainTabItem> = {
      report: reportTab,
      "attack-replay": replayTab,
      learning: learningTab,
      macro: macroTab,
      consistency: consistencyTab,
      stream: streamTab,
      timeline: timelineTab,
    };
    const modeOrder: Record<ProductViewMode, string[]> = {
      report: ["report", "attack-replay", "macro", "consistency", "learning", "stream", "timeline"],
      learn: ["learning", "attack-replay", "report", "macro", "consistency", "stream", "timeline"],
      auditor: ["macro", "consistency", "report", "attack-replay", "timeline", "stream", "learning"],
      raw: ["stream", "timeline", "report", "macro", "consistency", "attack-replay", "learning"],
    };
    return modeOrder[viewMode].map((key) => tabMap[key]);
  }, [automatedReview, events, language, macroAnalysis, selectedAgent, task, taskId, viewMode]);

  const inspectorTabItems = useMemo(
    () => [
      {
        key: "agents",
        label: (
          <Space size={6}>
            <Bot size={14} />
            {t(language, "agentBriefTab")}
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
        key: "agent-files",
        label: (
          <Space size={6}>
            <FolderOpen size={14} />
            {t(language, "fileLogsTab")}
          </Space>
        ),
        children: <AgentFileLogs taskId={taskId ?? ""} />,
      },
      {
        key: "summary",
        label: t(language, "taskTab"),
        children: (
          <div className="task-detail-list">
            <div>
              <span>{t(language, "taskId")}</span>
              <Typography.Text copyable className="text-mono">
                {taskId}
              </Typography.Text>
            </div>
            <div>
              <span>{t(language, "status")}</span>
              <Space size={6}>
                <Tag color={getStatusColor(task?.status)}>{task?.status}</Tag>
                {task?.archived ? <Tag>{t(language, "archived")}</Tag> : null}
              </Space>
            </div>
            <div>
              <span>{t(language, "created")}</span>
              <Typography.Text>{task?.created_at ?? "N/A"}</Typography.Text>
            </div>
            <div>
              <span>{t(language, "completed")}</span>
              <Typography.Text>{task?.completed_at ?? "N/A"}</Typography.Text>
            </div>
            <div>
              <span>{t(language, "error")}</span>
              <Typography.Text type={task?.error ? "danger" : "secondary"}>{task?.error ?? t(language, "none")}</Typography.Text>
            </div>
          </div>
        ),
      },
    ],
    [events, language, selectedAgent, task, taskId],
  );

  return (
    <Layout className="app-shell">
      <Header className="topbar">
        <Space size={12} className="review-topbar-main">
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/tasks")} title="返回任务控制台" />
          <Button icon={<Home size={16} />} onClick={() => navigate("/")} title="返回首页" />
          <span className="workbench-brand-mark compact"><img src={riskPilotLogo} alt="RiskPilot logo" /></span>
          <div className="review-title-block">
            <Typography.Title level={5} className="review-title">
              {task?.dapp_name ? `${task.dapp_name} Review` : "Review Workbench"}
            </Typography.Title>
            <Typography.Text type="secondary" className="text-mono">
              {taskId?.slice(0, 8)}...
            </Typography.Text>
          </div>
        </Space>
        <Space size={10}>
          <div className="view-mode-switcher">
            <Typography.Text className="view-mode-label">{language === "zh" ? "视图模式" : "View"}</Typography.Text>
            <Segmented
              value={viewMode}
              onChange={(value) => setViewMode(value as ProductViewMode)}
              options={[
                { label: modeLabel(language, "report"), value: "report" },
                { label: modeLabel(language, "learn"), value: "learn" },
                { label: modeLabel(language, "auditor"), value: "auditor" },
                { label: modeLabel(language, "raw"), value: "raw" },
              ]}
            />
          </div>
          <Segmented
            size="small"
            value={language}
            onChange={(value) => setLanguage(value as LanguageMode)}
            options={[
              { label: "中文", value: "zh" },
              { label: "EN", value: "en" },
            ]}
          />
          <Tag color={getStatusColor(task?.status)}>{task?.status ?? t(language, "loading")}</Tag>
          {task?.archived ? <Tag>{t(language, "archived")}</Tag> : null}
          <Tag>{task?.dapp_name ?? t(language, "unknownDapp")}</Tag>
          <Tag>{formatDuration(task?.duration)}</Tag>
          <Tag icon={wsOpen ? <Wifi size={13} /> : <WifiOff size={13} />} color={connectionColor}>
            {connectionLabel}
          </Tag>
          <DappContextButton dappName={task?.dapp_name} autoOpenKey={task?.task_id} />
          <Button icon={<Bot size={15} />} onClick={() => setAssistantOpen(true)}>
            取证助手
          </Button>
          <Button icon={<RefreshCcw size={15} />} onClick={refreshTask}>
            {t(language, "refresh")}
          </Button>
        </Space>
      </Header>

      <Content className="dashboard-layout">
        {errorMsg ? <Alert type="error" showIcon message={errorMsg} closable onClose={() => setErrorMsg("")} /> : null}

        <div className="task-overview">
          <div>
            <Typography.Text type="secondary">{t(language, "dapp")}</Typography.Text>
            <Typography.Title level={4}>{task?.dapp_name ?? "Loading..."}</Typography.Title>
          </div>
          <div className="overview-metrics">
            <div>
              <span className="metric-value">{totalLogs}</span>
              <span className="metric-label">{t(language, "logs")}</span>
            </div>
            <div>
              <span className="metric-value">{agentStats.filter((item) => item.total > 0).length}</span>
              <span className="metric-label">{t(language, "agents")}</span>
            </div>
            <div>
              <span className="metric-value">{formatDuration(task?.duration)}</span>
              <span className="metric-label">{t(language, "duration")}</span>
            </div>
          </div>
        </div>

        {loadingTask && !task ? (
          <div className="center-loading">
            <Spin />
          </div>
        ) : (
          <div className="workbench-grid">
            <AgentNavigator
              stats={agentStats}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              systemStatus={{
                label: systemStatusLabel,
                hint: systemStatusHint,
                tone: systemStatusTone,
              }}
            />

            <div className="analysis-center">
              <Tabs
                activeKey={activeMainTab}
                onChange={setActiveMainTab}
                items={mainTabItems}
              />
            </div>

            <aside className="inspector-panel">
              <Tabs
                defaultActiveKey="agents"
                items={inspectorTabItems}
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
      <ForensicAssistantDrawer
        open={assistantOpen}
        onOpen={() => setAssistantOpen(true)}
        onClose={() => setAssistantOpen(false)}
        scope="task"
        taskId={taskId}
        title="任务取证助手"
      />
    </Layout>
  );
};

export default Dashboard;
