import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Card, Col, Layout, Modal, Row, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Activity,
  Archive,
  CheckCircle2,
  Eye,
  ListChecks,
  Play,
  RefreshCcw,
  Square,
  Undo2,
  XCircle,
} from "lucide-react";
import DappContextButton from "../components/DappContextButton";
import { archiveTask, cancelTask, createTask, listDapps, listTasks, unarchiveTask } from "../services/api";
import { DappCatalogItem, Task, TaskCreateRequest, TaskStatus } from "../types";

const { Header, Content } = Layout;

const dappModules = import.meta.glob("../data/*.json", { eager: true, import: "default" });
const DAPP_OPTIONS = Object.keys(dappModules)
  .map((path) => path.split("/").pop()?.replace(/\.json$/, "") ?? "")
  .filter(Boolean)
  .sort((a, b) => a.localeCompare(b));

function getStatusColor(status: TaskStatus) {
  if (status === TaskStatus.COMPLETED) return "success";
  if (status === TaskStatus.FAILED) return "error";
  if (status === TaskStatus.RUNNING) return "processing";
  return "default";
}

function formatDuration(duration?: number | null) {
  if (duration == null) return "N/A";
  if (duration < 60) return `${duration.toFixed(1)}s`;
  return `${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    return response?.data?.detail ?? fallback;
  }
  return fallback;
}

function isRunnableTask(status: TaskStatus) {
  return status === TaskStatus.PENDING || status === TaskStatus.RUNNING;
}

const TaskList: React.FC = () => {
  const { message } = AntdApp.useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDapps, setSelectedDapps] = useState<string[]>([]);
  const [dappCatalog, setDappCatalog] = useState<DappCatalogItem[]>([]);
  const [dappCatalogLoading, setDappCatalogLoading] = useState(false);
  const [dappCatalogError, setDappCatalogError] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived" | "all">("active");
  const navigate = useNavigate();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setTasks(await listTasks(archiveFilter !== "active"));
    } catch {
      message.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, [archiveFilter, message]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  useEffect(() => {
    let cancelled = false;
    setDappCatalogLoading(true);
    listDapps()
      .then((catalog) => {
        if (cancelled) return;
        setDappCatalog(catalog.items);
        setDappCatalogError("");
      })
      .catch(() => {
        if (cancelled) return;
        setDappCatalog([]);
        setDappCatalogError("Backend case catalog is unavailable; using bundled frontend metadata.");
      })
      .finally(() => {
        if (!cancelled) setDappCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async () => {
    if (selectedDapps.length === 0) {
      message.error("Please select at least one DApp");
      return;
    }

    try {
      setLoading(true);
      const created: Task[] = [];
      for (const dappName of selectedDapps) {
        const req: TaskCreateRequest = { dapp_name: dappName };
        created.push(await createTask(req));
      }
      message.success(`${created.length} task(s) started`);
      setIsModalVisible(false);
      setSelectedDapps([]);
      await fetchTasks();
      if (created.length === 1) {
        navigate(`/tasks/${created[0].task_id}`);
      }
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "Failed to create task"));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (task: Task) => {
    try {
      await cancelTask(task.task_id);
      message.success("Task cancellation requested");
      await fetchTasks();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "Failed to cancel task"));
    }
  };

  const handleArchive = async (task: Task) => {
    try {
      await archiveTask(task.task_id);
      message.success("Task archived");
      await fetchTasks();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "Failed to archive task"));
    }
  };

  const handleRestore = async (task: Task) => {
    try {
      await unarchiveTask(task.task_id);
      message.success("Task restored");
      await fetchTasks();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "Failed to restore task"));
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (archiveFilter === "active" && task.archived) return false;
      if (archiveFilter === "archived" && !task.archived) return false;
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      return true;
    });
  }, [archiveFilter, statusFilter, tasks]);

  const stats = {
    total: filteredTasks.length,
    running: filteredTasks.filter((task) => task.status === TaskStatus.RUNNING).length,
    completed: filteredTasks.filter((task) => task.status === TaskStatus.COMPLETED).length,
    failed: filteredTasks.filter((task) => task.status === TaskStatus.FAILED).length,
  };

  const dappOptions = useMemo(() => {
    if (dappCatalog.length > 0) {
      return dappCatalog.map((item) => ({
        label: `${item.name}${item.demo_ready ? " · demo ready" : ""}${item.platform ? ` · ${item.platform}` : ""}`,
        value: item.name,
      }));
    }
    return DAPP_OPTIONS.map((name) => ({ label: name, value: name }));
  }, [dappCatalog]);

  const selectedDappDetail = useMemo(() => {
    if (selectedDapps.length !== 1) return null;
    return dappCatalog.find((item) => item.name === selectedDapps[0]) ?? null;
  }, [dappCatalog, selectedDapps]);

  const columns: ColumnsType<Task> = [
    {
      title: "DApp",
      dataIndex: "dapp_name",
      key: "dapp_name",
      render: (name: string) => <Typography.Text strong>{name}</Typography.Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: TaskStatus, record) => (
        <Space size={6}>
          <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>
          {record.archived ? <Tag>ARCHIVED</Tag> : null}
        </Space>
      ),
      filters: Object.values(TaskStatus).map((value) => ({ text: value, value })),
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      render: (value: string) => new Date(value).toLocaleString(),
    },
    {
      title: "Duration",
      dataIndex: "duration",
      key: "duration",
      render: (value?: number | null) => formatDuration(value),
    },
    {
      title: "Action",
      key: "action",
      width: 420,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<Eye size={14} />} onClick={() => navigate(`/tasks/${record.task_id}`)}>
            View
          </Button>
          <DappContextButton dappName={record.dapp_name} />
          {isRunnableTask(record.status) ? (
            <Button size="small" icon={<Square size={14} />} danger onClick={() => handleCancel(record)}>
              Cancel
            </Button>
          ) : record.archived ? (
            <Button size="small" icon={<Undo2 size={14} />} onClick={() => handleRestore(record)}>
              Restore
            </Button>
          ) : (
            <Button size="small" icon={<Archive size={14} />} onClick={() => handleArchive(record)}>
              Archive
            </Button>
          )}
       </Space>
      ),
    },
  ];

  return (
    <Layout className="app-shell">
      <Header className="topbar">
        <div className="topbar-brand">
          <Typography.Text className="brand-kicker">Multi-Agent Security Analysis</Typography.Text>
          <Typography.Title level={3} className="topbar-title">
            TracePilot Dashboard
          </Typography.Title>
          <Typography.Text type="secondary" className="topbar-subtitle">
            Live trace debugging, persisted evidence, and reproducible audit runs.
          </Typography.Text>
        </div>
        <Space>
          <Button icon={<RefreshCcw size={15} />} onClick={fetchTasks}>
            Refresh
          </Button>
          <Button type="primary" icon={<Play size={15} />} onClick={() => setIsModalVisible(true)}>
            New Task
          </Button>
        </Space>
      </Header>

      <Content className="task-list-page">
        <Row gutter={[16, 16]} className="stat-row">
          <Col xs={12} lg={6}>
            <Card className="metric-card metric-card-total">
              <div className="metric-card-inner">
                <span className="metric-icon">
                  <ListChecks size={22} />
                </span>
                <div>
                  <span className="metric-label">Total Tasks</span>
                  <span className="metric-value large">{stats.total}</span>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card className="metric-card metric-card-running">
              <div className="metric-card-inner">
                <span className="metric-icon">
                  <Activity size={22} />
                </span>
                <div>
                  <span className="metric-label">Running</span>
                  <span className="metric-value large text-blue">{stats.running}</span>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card className="metric-card metric-card-completed">
              <div className="metric-card-inner">
                <span className="metric-icon">
                  <CheckCircle2 size={22} />
                </span>
                <div>
                  <span className="metric-label">Completed</span>
                  <span className="metric-value large text-green">{stats.completed}</span>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card className="metric-card metric-card-failed">
              <div className="metric-card-inner">
                <span className="metric-icon">
                  <XCircle size={22} />
                </span>
                <div>
                  <span className="metric-label">Failed</span>
                  <span className="metric-value large text-red">{stats.failed}</span>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Card className="table-card">
          <div className="table-toolbar">
            <div>
              <Typography.Title level={5}>Tasks</Typography.Title>
              <Typography.Text type="secondary">Create, resume, and inspect analysis runs.</Typography.Text>
            </div>
            <Select
              value={archiveFilter}
              onChange={setArchiveFilter}
              options={[
                { label: "Active tasks", value: "active" },
                { label: "Archived", value: "archived" },
                { label: "All records", value: "all" },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { label: "All statuses", value: "all" },
                { label: "Pending", value: TaskStatus.PENDING },
                { label: "Running", value: TaskStatus.RUNNING },
                { label: "Completed", value: TaskStatus.COMPLETED },
                { label: "Failed", value: TaskStatus.FAILED },
              ]}
            />
          </div>

          <Table
            dataSource={filteredTasks}
            columns={columns}
            rowKey="task_id"
            loading={loading}
            pagination={{ pageSize: 10, size: "small" }}
          />
        </Card>
      </Content>

      <Modal
        title="New Analysis Task"
        open={isModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setIsModalVisible(false);
          setSelectedDapps([]);
        }}
        confirmLoading={loading}
        centered
      >
        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
          <Typography.Text type="secondary">Select one or more DApps to analyze.</Typography.Text>
          <Select
            mode="multiple"
            size="large"
            placeholder="Select DApp(s)"
            style={{ width: "100%" }}
            value={selectedDapps}
            onChange={setSelectedDapps}
            options={dappOptions}
            showSearch
            optionFilterProp="label"
            loading={dappCatalogLoading}
          />
          {dappCatalogError ? <Typography.Text type="warning">{dappCatalogError}</Typography.Text> : null}
          {selectedDappDetail ? (
            <div className="case-catalog-preview">
              <Space size={6} wrap>
                {selectedDappDetail.demo_ready ? <Tag color="green">Demo ready</Tag> : <Tag>Raw case</Tag>}
                {selectedDappDetail.has_processed_analysis ? <Tag color="blue">Macro analysis</Tag> : null}
                {selectedDappDetail.platform ? <Tag>{selectedDappDetail.platform}</Tag> : null}
                {selectedDappDetail.cause ? <Tag>{selectedDappDetail.cause}</Tag> : null}
              </Space>
              <Typography.Text type="secondary">
                {selectedDappDetail.transaction_count} transaction(s)
                {selectedDappDetail.root_cause ? ` · root cause: ${selectedDappDetail.root_cause}` : ""}
              </Typography.Text>
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Typography.Text type="secondary">
              View case context while the analysis task is running.
            </Typography.Text>
            <DappContextButton
              dappName={selectedDapps.length === 1 ? selectedDapps[0] : undefined}
              disabled={selectedDapps.length !== 1}
            />
          </div>
        </Space>
      </Modal>
    </Layout>
  );
};

export default TaskList;

