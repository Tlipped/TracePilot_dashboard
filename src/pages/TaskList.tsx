import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Card, Col, Layout, Modal, Row, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { Eye, Play, RefreshCcw, Square, Trash2 } from "lucide-react";
import { cancelTask, createTask, listTasks } from "../services/api";
import { Task, TaskCreateRequest, TaskStatus } from "../types";

const { Header, Content } = Layout;

const dappModules = import.meta.glob("../data/*.json");
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

const TaskList: React.FC = () => {
  const { message } = AntdApp.useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDapps, setSelectedDapps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const navigate = useNavigate();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setTasks(await listTasks());
    } catch {
      message.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

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

  const filteredTasks = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((task) => task.status === statusFilter);
  }, [statusFilter, tasks]);

  const stats = {
    total: tasks.length,
    running: tasks.filter((task) => task.status === TaskStatus.RUNNING).length,
    completed: tasks.filter((task) => task.status === TaskStatus.COMPLETED).length,
    failed: tasks.filter((task) => task.status === TaskStatus.FAILED).length,
  };

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
      render: (status: TaskStatus) => <Tag color={getStatusColor(status)}>{status.toUpperCase()}</Tag>,
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
      width: 210,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<Eye size={14} />} onClick={() => navigate(`/tasks/${record.task_id}`)}>
            View
          </Button>
          <Button
            size="small"
            icon={record.status === TaskStatus.RUNNING ? <Square size={14} /> : <Trash2 size={14} />}
            danger={record.status === TaskStatus.RUNNING}
            disabled={record.status === TaskStatus.COMPLETED || record.status === TaskStatus.FAILED}
            onClick={() => handleCancel(record)}
          >
            Cancel
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Layout className="app-shell">
      <Header className="topbar">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            TracePilot
          </Typography.Title>
          <Typography.Text type="secondary">Agent observability dashboard</Typography.Text>
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
            <Card>
              <span className="metric-label">Total Tasks</span>
              <span className="metric-value large">{stats.total}</span>
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <span className="metric-label">Running</span>
              <span className="metric-value large text-blue">{stats.running}</span>
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <span className="metric-label">Completed</span>
              <span className="metric-value large text-green">{stats.completed}</span>
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <span className="metric-label">Failed</span>
              <span className="metric-value large text-red">{stats.failed}</span>
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
            options={DAPP_OPTIONS.map((name) => ({ label: name, value: name }))}
            showSearch
            optionFilterProp="label"
          />
        </Space>
      </Modal>
    </Layout>
  );
};

export default TaskList;
