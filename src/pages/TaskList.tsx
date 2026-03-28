import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Select, Tag, Space, message, Layout, Typography, Card, Statistic, Row, Col, Progress } from 'antd';
import { useNavigate } from 'react-router-dom';
import { RocketOutlined, CheckCircleOutlined, SyncOutlined, BugOutlined } from '@ant-design/icons';
import axios from 'axios';
import { Task, TaskStatus, TaskCreateRequest } from '../types';
import WebSocketService from '../services/WebSocketService';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// 获取data目录下所有JSON文件名的函数
const getJsonFiles = (): string[] => {
  // 这里硬编码列出data目录中的所有JSON文件（不含扩展名）
  return [
    'ADC', 'Alchemix', 'ApeCoin (APE)', 'Astrid Finance', 'Audius', 'AzukiDAO', 'BBT', 'BEARNDAO', 'BEGO', 'BNO', 'BRA', 'BTC20', 'BUNN', 'Balancer', 'BarleyFinance', 'Beanstalk', 'Bearn', 'Bedrock_DeFi', 'Bitpaidio', 'BrahTOPG', 'Burner', 'Burntbubba', 'Bybit', 'ChaingeFinance', 'ChannelsFinance', 'Circle', 'Civfund', 'CompoundUni', 'Conic Finance 02', 'Cover', 'CowSwap', 'CreamFinance', 'CurveBurner', 'DAO_SoulMate', 'DAppSocial', 'DEPUSDT', 'DEPUSDT_LEVUSDC', 'DFXFinance', 'DODO', 'Dexible', 'EFLeverVault', 'EFVault', 'EHIVE', 'EarningFram', 'ElasticSwap', 'ElevenFinance', 'Euler Finance', 'FDP', 'FEGtoken', 'FFIST', 'ForceDAO', 'FormationFi', 'FortressProtocol', 'GFOX', 'Game', 'GoodCompound', 'HeavensGate', 'HedgeyFinance', 'Hegic', 'HopeLend', 'HoppyFrogERC', 'IndexedFinance', 'InverseFinance', 'JAY', 'JokInTheBox', 'Juice', 'Kashi', 'KyberSwap', 'LPMine', 'LiFi', 'LibertiVault', 'Local Trade LCT', 'MCC', 'MEVBOTa47b', 'MIMSpell', 'MaestroRouter2', 'MahaLend', 'Melo', 'MerlinLab', 'MetaLend', 'MorphoBlue', 'Mosca', 'NBANFT', 'NUM', 'Nmbplatform', 'OMPx Contract', 'OlympusDAO', 'OmniEstate', 'OnyxProtocol', 'Orion Protocol', 'PHIL', 'PancakeHunny', 'Pandora', 'Paraswap', 'ParticleTrade', 'PawnFi', 'PeapodsFinance', 'Poolz', 'PopsicleFinance', 'PunkProtocol', 'QubitFinance', 'Raft_fi', 'RevertFinance', 'RevestFinance', 'RikkeiFinance', 'SHOCO', 'SaddleFinance', 'SafeMoon', 'SashimiSwap', 'Seneca', 'Sheep', 'Soda', 'SorStaking', 'SpaceGodzilla', 'Spectra_finance', 'SushiSwap', 'SwarmMarkets', 'TINU', 'Templedao', 'TheNFTV2', 'Thena', 'TrustPad', 'UFDao', 'USDTStakingContract28', 'Uerii Token', 'UmbrellaNetwork', 'UniBotRouter', 'UnizenIO', 'UnverifiedContr_0x00C409', 'UnverifiedContr_0x452E25', 'UraniumFinance', 'Uwerx', 'VINU', 'VisorFinance', 'WIFCOIN_ETH', 'WaultFinance', 'WildCredit', 'WiseLending', 'XCarnival', 'XSTABLE Protocol', 'Xave Finance', 'Yearn', 'Zenterest', 'Zoomer', 'ZunamiProtocol', 'bZx(0215)', 'bZx(0913)', 'bZxProtocol', 'landNFT'
  ];
};

const TaskList: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDapps, setSelectedDapps] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axios.get<Task[]>('http://localhost:8000/api/tasks');
      setTasks(res.data);
    } catch (e) {
      message.error('Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!selectedDapps || selectedDapps.length === 0) {
      message.error('Please select at least one DApp name');
      return;
    }

    // 循环创建每个选定的DApp任务
    for (const dappName of selectedDapps) {
      try {
        setLoading(true);
        const req: TaskCreateRequest = { dapp_name: dappName };
        const res = await axios.post<Task>('http://localhost:8000/api/tasks', req);
        message.success(`${dappName} task started!`);
      } catch (e: any) {
        message.error(`${dappName}: ${e.response?.data?.detail || 'Failed to create task'}`);
      }
    }

    setIsModalVisible(false);
    setSelectedDapps([]);
    setLoading(false);
    // 可以导航到第一个任务，或者刷新任务列表
    if (selectedDapps.length > 0) {
      setTimeout(() => {
        fetchTasks(); // 刷新任务列表
      }, 1000);
    }
  };

  // 统计数据
  const stats = {
    total: tasks.length,
    running: tasks.filter(t => t.status === TaskStatus.RUNNING).length,
    completed: tasks.filter(t => t.status === TaskStatus.COMPLETED).length,
    failed: tasks.filter(t => t.status === TaskStatus.FAILED).length,
  };

  const columns = [
    {
      title: 'DApp INSTANCE',
      dataIndex: 'dapp_name',
      key: 'dapp_name',
      render: (name: string) => (
        <Space>
          <BugOutlined style={{ color: '#1890ff' }} />
          <Text strong style={{ color: '#fff', letterSpacing: '1px' }}>{name.toUpperCase()}</Text>
        </Space>
      )
    },
    {
      title: 'STABILITY STATUS',
      dataIndex: 'status',
      key: 'status',
      render: (status: TaskStatus) => {
        const config = {
          [TaskStatus.PENDING]: { color: 'gold', icon: <SyncOutlined spin /> },
          [TaskStatus.RUNNING]: { color: '#096dd9', icon: <SyncOutlined spin /> },
          [TaskStatus.COMPLETED]: { color: '#389e0d', icon: <CheckCircleOutlined /> },
          [TaskStatus.FAILED]: { color: '#cf1322', icon: <BugOutlined /> },
        };
        return (
          <Tag icon={config[status].icon} color={config[status].color} style={{ borderRadius: 0, padding: '2px 10px' }}>
            {status.toUpperCase()}
          </Tag>
        );
      }
    },
    {
      title: 'ANALYSIS PROGRESS',
      key: 'progress',
      render: (_: any, record: Task) => (
        <Progress 
          percent={record.status === TaskStatus.COMPLETED ? 100 : record.status === TaskStatus.RUNNING ? 75 : 0} 
          size="small" 
          status={record.status === TaskStatus.FAILED ? 'exception' : 'active'}
          strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
        />
      )
    },
    {
      title: 'TIMESTAMP',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => <Text style={{ color: '#666', fontFamily: 'monospace' }}>{new Date(date).toLocaleString()}</Text>
    },
    {
      title: 'COMMAND',
      key: 'action',
      render: (_: any, record: Task) => (
        <Button 
          type="primary" 
          ghost 
          icon={<RocketOutlined />} 
          onClick={() => navigate(`/tasks/${record.task_id}`)}
          style={{ border: '1px solid #1890ff', borderRadius: 0 }}
        >
          ENTER CONSOLE
        </Button>
      ),
    },
  ];

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <style>{`
        .scan-line {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #1890ff, transparent);
          animation: scan 3s linear infinite;
          z-index: 9999;
        }
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
      <Header style={{ background: 'rgba(0,0,0,0.8)', borderBottom: '1px solid #333', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '40px', height: '40px', background: '#1890ff', marginRight: '15px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px #1890ff' }}>
            <BugOutlined style={{ fontSize: '24px', color: '#fff' }} />
          </div>
          <Title level={2} style={{ color: '#fff', margin: 0, letterSpacing: '2px', textShadow: '0 0 10px rgba(24,144,255,0.5)' }}>
            TRACEPILOT <span style={{ fontWeight: 200, color: '#666' }}>CONSOLE</span>
          </Title>
        </div>
        <Button 
          type="primary" 
          size="large" 
          icon={<RocketOutlined />}
          onClick={() => setIsModalVisible(true)}
          style={{ height: '45px', borderRadius: 0, background: '#1890ff', boxShadow: '0 0 15px rgba(24,144,255,0.4)' }}
        >
          NEW DEPLOYMENT
        </Button>
      </Header>

      <Content style={{ padding: '30px', overflowY: 'auto' }}>
        {/* 顶部统计卡片 */}
        <Row gutter={16} style={{ marginBottom: '30px' }}>
          <Col span={6}>
            <Card bordered={false} hoverable>
              <Statistic title={<Text style={{color: '#888'}}>TOTAL INSTANCES</Text>} value={stats.total} prefix={<BugOutlined />} valueStyle={{ color: '#fff' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} hoverable>
              <Statistic title={<Text style={{color: '#888'}}>ACTIVE ANALYZING</Text>} value={stats.running} valueStyle={{ color: '#1890ff' }} prefix={<SyncOutlined spin />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} hoverable>
              <Statistic title={<Text style={{color: '#888'}}>SUCCESSFUL FIXES</Text>} value={stats.completed} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} hoverable>
              <Statistic title={<Text style={{color: '#888'}}>SYSTEM CRITICAL</Text>} value={stats.failed} valueStyle={{ color: '#ff4d4f' }} prefix={<BugOutlined />} />
            </Card>
          </Col>
        </Row>

        <Table 
          dataSource={tasks} 
          columns={columns} 
          rowKey="task_id"
          loading={loading}
          pagination={{ pageSize: 8 }}
          className="custom-table"
          style={{ background: '#141414' }}
        />
      </Content>

      <Modal
        title={<Title level={4} style={{color: '#1890ff'}}>DEPLOY NEW ANALYSIS AGENT</Title>}
        open={isModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setIsModalVisible(false);
          setSelectedDapps([]);
        }}
        confirmLoading={loading}
        centered
        styles={{ body: { background: '#141414', border: '1px solid #1890ff' } }}
      >
        <div style={{ padding: '20px 0' }}>
          <Text style={{ color: '#888', display: 'block', marginBottom: '10px' }}>SELECT TARGET DAPP(S):</Text>
          <Select
            mode="multiple"
            size="large"
            placeholder="Select DApp(s) to analyze"
            style={{ width: '100%', borderRadius: 0, background: '#000', color: '#fff', border: '1px solid #333' }}
            value={selectedDapps}
            onChange={setSelectedDapps}
            options={getJsonFiles().map(file => ({ label: file, value: file }))}
            dropdownStyle={{ background: '#141414', color: '#fff' }}
            optionRender={(option) => (
              <div style={{ color: '#fff', padding: '6px 12px' }}>{option.data.label}</div>
            )}
          />
        </div>
      </Modal>
    </Layout>
  );
};

export default TaskList;