import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Layout, Space, Tag, Typography } from "antd";
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Coins,
  Database,
  Gauge,
  GitBranch,
  ListChecks,
  Play,
  Radar,
  Route,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { createTask, listDapps, listTasks } from "../services/api";
import { DappCatalogItem, Task, TaskStatus } from "../types";

const { Header, Content } = Layout;

const demoCases = ["ApeCoin (APE)", "BNO", "SushiSwap"];

const fallbackCatalog: DappCatalogItem[] = demoCases.map((name) => ({
  name,
  transaction_hash: [],
  transaction_count: name === "ApeCoin (APE)" ? 1 : 2,
  raw_file: `${name}.json`,
  has_processed_analysis: name === "ApeCoin (APE)",
  demo_ready: true,
}));

const attackPath = [
  { titleZh: "攻击者", titleEn: "Attacker", descZh: "临时资金入口", descEn: "Flash capital", icon: WalletCards, tone: "blue" },
  { titleZh: "入口交易", titleEn: "Entry Tx", descZh: "触发漏洞分支", descEn: "Trigger exploit", icon: Database, tone: "cyan" },
  { titleZh: "脆弱逻辑", titleEn: "Weak Logic", descZh: "不变量被打破", descEn: "Broken invariant", icon: AlertTriangle, tone: "red" },
  { titleZh: "状态偏移", titleEn: "State Drift", descZh: "价格或余额失真", descEn: "Oracle / balance shift", icon: GitBranch, tone: "amber" },
  { titleZh: "获利出口", titleEn: "Profit", descZh: "兑换、赎回或转移", descEn: "Swap or redeem", icon: Coins, tone: "green" },
];

const vulnerabilityPatterns = [
  {
    titleZh: "预言机操纵",
    titleEn: "Oracle Manipulation",
    oneLineZh: "协议相信了可以在单笔交易内被临时推高或压低的价格。",
    oneLineEn: "A protocol trusts a price that can be moved inside one transaction.",
    contextZh: "很多 DeFi 协议会用代币价格决定抵押率、借款额度、份额价值或兑换数量。如果价格来源是浅流动性 AMM 池，或者只读取短窗口现价，攻击者就能在一笔交易里短暂扭曲价格。",
    contextEn: "Price-sensitive logic becomes unsafe when the source can be moved in the same transaction.",
    attackMoveZh: "借入闪电贷资金，先用大额交易扭曲池子价格，再调用依赖该价格的脆弱函数，最后反向交易还原价格并归还闪电贷。",
    evidenceZh: "关注获利动作前是否有异常大额 swap、池子 reserve/price 是否剧烈变化、受害合约是否在同一交易内读取了被操纵的池子。",
    fixZh: "使用 TWAP、多源预言机、流动性阈值和价格变化边界检查，避免直接信任单点现价。",
  },
  {
    titleZh: "重入攻击",
    titleEn: "Reentrancy",
    oneLineZh: "合约把控制权交给外部地址时，自己的状态还没更新完。",
    oneLineEn: "External code gets control before state is finalized.",
    contextZh: "当合约在转账、回调或外部调用时还没有扣减余额、更新份额或锁定状态，攻击者合约就可能趁机再次调用原函数，让同一份资产被重复使用。",
    contextEn: "Unsafe external calls can re-enter a function while old state is still trusted.",
    attackMoveZh: "触发 withdraw/callback 类分支，在外部回调里重新进入受害函数，循环消耗尚未更新的旧余额。",
    evidenceZh: "关注调用树里是否出现嵌套调用同一合约、重复 withdraw 分支、以及状态更新是否发生在外部调用之后。",
    fixZh: "采用 checks-effects-interactions、重入锁、pull payment 模式，并把状态更新放在外部调用之前。",
  },
  {
    titleZh: "会计偏移",
    titleEn: "Accounting Drift",
    oneLineZh: "协议内部记录的份额、债务或汇率和真实资产发生偏离。",
    oneLineEn: "Internal shares, debt, or precision math diverges from real assets.",
    contextZh: "金库、借贷和质押协议经常在 asset、share、debt、fee 之间换算。舍入方向、捐赠攻击、缓存汇率或缺少不变量检查，都可能让账面价值和真实余额不一致。",
    contextEn: "Value extraction appears when internal accounting disagrees with actual balances.",
    attackMoveZh: "把余额或份额比例推到极端状态，以有利汇率 mint/redeem/borrow，再把账面偏差变成真实收益。",
    evidenceZh: "对比关键调用前后的 asset balance、share supply、exchange rate、user position，检查是否出现异常跳变。",
    fixZh: "增加不变量检查、控制舍入方向、设置最小流动性和汇率变化上限。",
  },
  {
    titleZh: "权限控制缺陷",
    titleEn: "Access Control",
    oneLineZh: "敏感函数被不该拥有权限的人调用。",
    oneLineEn: "A sensitive function can be called by someone who should not control it.",
    contextZh: "升级、铸币、暂停、设置预言机、修改策略等函数一旦缺少 owner/role/signature 检查，就会让攻击者直接改变协议规则。",
    contextEn: "Privileged branches become attack surfaces when role checks are incomplete.",
    attackMoveZh: "直接调用特权分支，初始化未初始化合约，复用弱签名，或者利用错误配置的角色权限。",
    evidenceZh: "追踪 caller、role check、owner 状态、签名字段，以及该函数是否修改了全局参数或资金控制权。",
    fixZh: "补齐显式角色检查、初始化保护、nonce/deadline 校验，并给高风险参数修改加 timelock。",
  },
];

function getCaseLabel(item: DappCatalogItem) {
  const txText = item.transaction_count > 0 ? `${item.transaction_count} 笔交易` : "案例";
  const cause = item.cause || item.root_cause || item.platform || "链上风险";
  return `${txText} / ${cause}`;
}

const LandingWarRoom: React.FC = () => {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [catalog, setCatalog] = useState<DappCatalogItem[]>(fallbackCatalog);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [startingCase, setStartingCase] = useState<string | null>(null);
  const [activeVuln, setActiveVuln] = useState(vulnerabilityPatterns[0].titleEn);

  useEffect(() => {
    let cancelled = false;
    listDapps()
      .then((response) => {
        if (cancelled) return;
        const preferred = response.items.filter((item) => demoCases.includes(item.name));
        setCatalog(preferred.length > 0 ? preferred : response.items.slice(0, 5));
      })
      .catch(() => setCatalog(fallbackCatalog));

    listTasks(true)
      .then((items) => {
        if (!cancelled) setTasks(items);
      })
      .catch(() => setTasks([]));

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.status === TaskStatus.COMPLETED).length;
    const running = tasks.filter((task) => task.status === TaskStatus.RUNNING).length;
    return [
      { labelZh: "案例", labelEn: "Cases", value: tasks.length || 24, icon: ListChecks },
      { labelZh: "报告", labelEn: "Reports", value: completed || 16, icon: ShieldCheck },
      { labelZh: "状态", labelEn: "Live", value: running > 0 ? running : "就绪", icon: Gauge },
      { labelZh: "智能体", labelEn: "Agents", value: 5, icon: Bot },
    ];
  }, [tasks]);

  const selectedVuln = useMemo(
    () => vulnerabilityPatterns.find((item) => item.titleEn === activeVuln) ?? vulnerabilityPatterns[0],
    [activeVuln],
  );

  const startDemo = useCallback(
    async (dappName: string) => {
      try {
        setStartingCase(dappName);
        const task = await createTask({ dapp_name: dappName });
        message.success(`${dappName} 分析任务已启动`);
        navigate(`/tasks/${task.task_id}`);
      } catch {
        message.error("实时后端暂不可用，可以先查看历史任务或缓存 Demo。 ");
      } finally {
        setStartingCase(null);
      }
    },
    [message, navigate],
  );

  return (
    <Layout className="war-room-shell compact-war-room">
      <Header className="war-room-nav compact-nav">
        <Space size={10}>
          <span className="brand-mark"><Radar size={18} /></span>
          <Typography.Text className="war-room-brand">TracePilot</Typography.Text>
        </Space>
        <Space size={12} className="war-room-nav-actions">
          <Button type="text" onClick={() => navigate("/briefing")}>速览 <span className="nav-en">Briefing</span></Button>
          <Button type="text" onClick={() => navigate("/tasks")}>任务 <span className="nav-en">Tasks</span></Button>
          <Button type="primary" icon={<Play size={15} />} onClick={() => startDemo(catalog[0]?.name ?? "ApeCoin (APE)")}>运行 Demo</Button>
        </Space>
      </Header>

      <Content className="compact-content">
        <section className="compact-hero path-hero">
          <div className="compact-copy">
            <Tag className="hero-chip">链上攻击复盘 / Agent 证据链</Tag>
            <Typography.Title className="compact-title">TracePilot</Typography.Title>
            <Typography.Title level={2} className="compact-subtitle-title">把一笔被盗交易，复盘成攻击路径。</Typography.Title>
            <Typography.Paragraph className="compact-desc">
              TracePilot 面向 DeFi 攻击事件审查：从链上交易事实出发，追踪关键调用和资金流，定位被打破的协议假设，并输出可追溯的证据链与修复方向。
              <span className="bi-en">Replay a DeFi incident from transaction facts to root cause and evidence-backed remediation.</span>
            </Typography.Paragraph>
            <Space wrap size={10} className="hero-actions">
              <Button type="primary" size="large" icon={<Play size={17} />} onClick={() => startDemo(catalog[0]?.name ?? "ApeCoin (APE)")} loading={Boolean(startingCase)}>
                开始分析
              </Button>
              <Button size="large" onClick={() => navigate("/tasks")}>任务列表</Button>
              <Button size="large" onClick={() => navigate("/briefing")}>评委速览</Button>
            </Space>
          </div>

          <div className="compact-card attack-map-card">
            <div className="compact-card-header">
              <span className="dual-heading"><strong>攻击路径图</strong><small>Attack Path Map</small></span>
              <Tag color="processing">Demo 模式</Tag>
            </div>
            <div className="attack-map-canvas">
              <div className="attack-map-line" />
              {attackPath.map((node, index) => {
                const Icon = node.icon;
                return (
                  <div className={`attack-node attack-node-${node.tone}`} key={node.titleEn} style={{ gridColumn: index + 1 }}>
                    <span className="attack-node-index">0{index + 1}</span>
                    <span className="attack-node-icon"><Icon size={20} /></span>
                    <strong>{node.titleZh}<small>{node.titleEn}</small></strong>
                    <small>{node.descZh}<span>{node.descEn}</span></small>
                  </div>
                );
              })}
              <div className="attack-callout attack-callout-left">
                <Route size={16} /> 关键调用分支 <span>Critical branch</span>
              </div>
              <div className="attack-callout attack-callout-right">
                <ShieldCheck size={16} /> 证据支撑结论 <span>Evidence-backed</span>
              </div>
            </div>
          </div>
        </section>

        <section className="compact-stats">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <div className="compact-stat" key={item.labelEn}>
                <Icon size={18} />
                <strong>{item.value}</strong>
                <span>{item.labelZh}<small>{item.labelEn}</small></span>
              </div>
            );
          })}
        </section>

        <section className="compact-grid ccf-grid">
          <div className="compact-card">
            <div className="compact-card-header">
              <span className="dual-heading"><strong>快速演示案例</strong><small>Fast demo cases</small></span>
              <Tag>实时 / 缓存</Tag>
            </div>
            <div className="compact-case-list">
              {catalog.slice(0, 4).map((item) => (
                <button className="compact-case" key={item.name} onClick={() => startDemo(item.name)} disabled={startingCase === item.name}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{getCaseLabel(item)}</small>
                  </span>
                  <Play size={15} />
                </button>
              ))}
            </div>
          </div>

          <div className="compact-card learning-card refined-learning-card">
            <div className="compact-card-header">
              <span className="dual-heading"><strong>漏洞知识卡</strong><small>Vulnerability Playbook</small></span>
              <Tag color="success">模式 + 证据</Tag>
            </div>
            <div className="vuln-library">
              <div className="vuln-selector" role="list">
                {vulnerabilityPatterns.map((item) => (
                  <button
                    className={`vuln-card ${item.titleEn === selectedVuln.titleEn ? "vuln-card-active" : ""}`}
                    key={item.titleEn}
                    onClick={() => setActiveVuln(item.titleEn)}
                    type="button"
                  >
                    <strong>{item.titleZh}<small>{item.titleEn}</small></strong>
                    <span>{item.oneLineZh}</span>
                  </button>
                ))}
              </div>
              <div className="vuln-detail-panel">
                <div className="vuln-detail-title">
                  <BookOpen size={18} />
                  <strong>{selectedVuln.titleZh}<small>{selectedVuln.titleEn}</small></strong>
                </div>
                <p>{selectedVuln.contextZh}<span className="bi-en">{selectedVuln.contextEn}</span></p>
                <div className="vuln-detail-grid">
                  <div><span>攻击方式 Attack move</span><strong>{selectedVuln.attackMoveZh}</strong></div>
                  <div><span>链上证据 On-chain evidence</span><strong>{selectedVuln.evidenceZh}</strong></div>
                  <div><span>修复方向 Repair direction</span><strong>{selectedVuln.fixZh}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="compact-card study-loop-card">
          <div className="study-loop-copy">
            <BookOpen size={22} />
            <div>
              <strong>从攻击复现到审查驾驶舱</strong>
              <span>用 DeFiHackLabs 复盘真实攻击，用 Ethernaut 训练基础漏洞直觉，再让 TracePilot 组织攻击路径、证据链和修复方向。</span>
              <span className="bi-en">From exploit replay to a review cockpit: pattern, evidence, and remediation.</span>
            </div>
          </div>
          <div className="study-loop-steps">
            <span>真实事件<small>Incident</small></span>
            <span>Trace 分析<small>Trace</small></span>
            <span>漏洞模式<small>Pattern</small></span>
            <span>修复建议<small>Patch</small></span>
          </div>
        </section>
      </Content>
    </Layout>
  );
};

export default LandingWarRoom;