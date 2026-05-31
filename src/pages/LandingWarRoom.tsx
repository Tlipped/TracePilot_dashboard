import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Layout, Space, Tag, Typography } from "antd";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Coins,
  Database,
  GitBranch,
  Library,
  Play,
  Radar,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { listDapps, listTasks } from "../services/api";
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
  { zh: "攻击者", en: "Attacker", desc: "借入临时资金", icon: WalletCards, tone: "blue" },
  { zh: "入口交易", en: "Entry Tx", desc: "触发异常分支", icon: Database, tone: "cyan" },
  { zh: "脆弱逻辑", en: "Weak Logic", desc: "协议假设被打破", icon: AlertTriangle, tone: "red" },
  { zh: "状态偏移", en: "State Drift", desc: "价格或余额失真", icon: GitBranch, tone: "amber" },
  { zh: "获利出口", en: "Profit", desc: "兑换、赎回、转移", icon: Coins, tone: "green" },
];

const vulnerabilityLessons = [
  {
    titleZh: "预言机操纵",
    titleEn: "Oracle Manipulation",
    beginnerHook: "先记住一句话：如果协议用一个很容易被临时推高/压低的价格做决策，攻击者就能在同一笔交易里先改价格，再薅协议。",
    mentalModel: "把 AMM 池想成一个临时秤。秤上的代币比例会影响价格，如果池子很浅，攻击者用大额 swap 就能短暂把秤拨歪。脆弱协议如果刚好相信这个秤，就会算错抵押、兑换或赎回价值。",
    attackSteps: [
      "借入闪电贷，获得足够大的临时资金。",
      "对低流动性池子做大额 swap，短暂扭曲价格。",
      "调用受害协议中依赖该价格的函数，例如 borrow、redeem、mint。",
      "反向交易恢复价格，归还闪电贷，留下套利收益。",
    ],
    traceChecklist: [
      "获利动作前是否有异常大额 swap。",
      "同一交易内 reserve、price、exchange rate 是否剧烈变化。",
      "受害合约是否直接读取 AMM spot price。",
      "利润是否来自被错误估值的借款、铸造或赎回。",
    ],
    practice: "学习路径：先看 DeFiHackLabs 中的 price/oracle 类攻击复现，再用 TracePilot 对照交易调用和资金流。",
  },
  {
    titleZh: "重入攻击",
    titleEn: "Reentrancy",
    beginnerHook: "先记住一句话：合约还没把账记完，就把控制权交给了别人，别人趁机又回来重复领钱。",
    mentalModel: "把协议想成柜台。正常流程应该是先登记余额减少，再把钱转出去。重入漏洞的问题是柜台先把钱递出去，攻击者拿到钱的一瞬间又冲回柜台，说自己余额还在。",
    attackSteps: [
      "攻击合约调用 withdraw、claim 或 callback 类函数。",
      "受害合约先进行外部转账或回调。",
      "攻击合约在回调里再次调用受害函数。",
      "受害合约仍读取旧余额，导致重复提现。",
    ],
    traceChecklist: [
      "调用树中是否出现同一函数/同一合约的嵌套调用。",
      "外部 call 是否发生在余额扣减之前。",
      "同一地址是否多次收到资产转出。",
      "是否缺少 reentrancy guard 或状态锁。",
    ],
    practice: "学习路径：先做 Ethernaut Reentrance 关卡，再看 DeFiHackLabs 真实重入案例。",
  },
  {
    titleZh: "会计偏移",
    titleEn: "Accounting Drift",
    beginnerHook: "先记住一句话：协议账本里记录的份额/汇率，和真实资产余额对不上，攻击者把这个差价变成收益。",
    mentalModel: "很多金库会用 share 表示你拥有多少份资产。问题出在 asset 和 share 的换算，如果有人能改变真实余额却不改变份额，或者利用舍入边界，就会让兑换比例失真。",
    attackSteps: [
      "把池子或金库推到极端状态，例如低份额、低余额或高汇率。",
      "通过 donation、mint、redeem 或 borrow 制造账面偏差。",
      "在错误汇率下兑换、赎回或借款。",
      "把内部账本偏差兑现成真实资产。",
    ],
    traceChecklist: [
      "asset balance、share supply、exchange rate 是否突然跳变。",
      "关键函数前后是否出现 donation 或非标准转账。",
      "计算中是否存在向下/向上舍入导致的边界收益。",
      "协议是否缺少最小流动性或汇率变化限制。",
    ],
    practice: "学习路径：重点整理 vault、lending、share price 类案例，把每次攻击前后的不变量写出来。",
  },
  {
    titleZh: "权限控制缺陷",
    titleEn: "Access Control",
    beginnerHook: "先记住一句话：不该有钥匙的人打开了管理员门。",
    mentalModel: "升级、铸币、暂停、设置预言机、修改策略都属于高危权限。如果函数没有检查调用者身份，或者初始化/签名逻辑有洞，攻击者就不需要复杂数学，直接改规则。",
    attackSteps: [
      "找到缺少 onlyOwner/role/signature 检查的敏感函数。",
      "直接调用特权分支，或初始化未初始化合约。",
      "修改价格源、策略地址、铸币权限或资金出口。",
      "转移资产或让协议进入攻击者控制的状态。",
    ],
    traceChecklist: [
      "调用者是否真的拥有 owner/role 权限。",
      "函数是否会修改全局参数或资金控制权。",
      "签名是否校验 nonce、deadline、chain id。",
      "代理合约或初始化函数是否被二次初始化。",
    ],
    practice: "学习路径：先把 Ethernaut 中 owner、delegatecall、privacy、preservation 类关卡做完，再回看真实权限事故。",
  },
];

function getCaseLabel(item: DappCatalogItem, task?: Task) {
  if (task?.status === TaskStatus.COMPLETED) return "已完成分析 / Cached report";
  if (task?.status === TaskStatus.RUNNING) return "正在分析 / Running";
  const txText = item.transaction_count > 0 ? `${item.transaction_count} 笔交易` : "案例";
  const cause = item.cause || item.root_cause || item.platform || "链上风险";
  return `${txText} / ${cause}`;
}

const LandingWarRoom: React.FC = () => {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [catalog, setCatalog] = useState<DappCatalogItem[]>(fallbackCatalog);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeVuln, setActiveVuln] = useState(vulnerabilityLessons[0].titleEn);

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

  const taskByDapp = useMemo(() => {
    const map = new Map<string, Task>();
    for (const name of demoCases) {
      const sameName = tasks.filter((task) => task.dapp_name === name && !task.archived);
      const preferred = sameName.find((task) => task.status === TaskStatus.COMPLETED) ?? sameName[0];
      if (preferred) map.set(name, preferred);
    }
    return map;
  }, [tasks]);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === TaskStatus.COMPLETED).length,
    [tasks],
  );

  const selectedVuln = useMemo(
    () => vulnerabilityLessons.find((item) => item.titleEn === activeVuln) ?? vulnerabilityLessons[0],
    [activeVuln],
  );

  const openCachedDemo = useCallback(
    (dappName: string) => {
      const task = taskByDapp.get(dappName);
      if (!task) {
        message.warning("这个案例还没有缓存任务，请先到任务库查看已有报告，或手动启动一次分析。");
        navigate("/tasks");
        return;
      }
      navigate(`/tasks/${task.task_id}`);
    },
    [message, navigate, taskByDapp],
  );

  return (
    <Layout className="landing-v2">
      <Header className="landing-v2-nav">
        <button className="landing-brand" type="button" onClick={() => navigate("/") }>
          <span className="landing-brand-mark"><Radar size={18} /></span>
          <span><strong>TracePilot</strong><small>Exploit review cockpit</small></span>
        </button>
        <Space size={10} className="landing-nav-actions">
          <Button type="text" onClick={() => navigate("/tasks")}>任务库</Button>
          <Button type="text" onClick={() => document.getElementById("vuln-tutorial")?.scrollIntoView({ behavior: "smooth" })}>漏洞教程</Button>
          <Button type="primary" icon={<Play size={15} />} onClick={() => openCachedDemo("ApeCoin (APE)")}>查看缓存 Demo</Button>
        </Space>
      </Header>

      <Content className="landing-v2-content">
        <section className="landing-stage">
          <div className="stage-watermark">TP</div>
          <div className="stage-copy">
            <Tag className="stage-chip">链上攻击复盘 / Agent 证据链</Tag>
            <Typography.Title className="stage-title">TracePilot</Typography.Title>
            <Typography.Title level={2} className="stage-subtitle">把一笔被盗交易，复盘成可解释的攻击路径。</Typography.Title>
            <Typography.Paragraph className="stage-desc">
              面向 DeFi 攻击事件审查：从交易事实出发，追踪关键调用、资金流和状态变化，定位被打破的协议假设，并输出证据链与修复方向。
            </Typography.Paragraph>
            <div className="stage-facts">
              <span><strong>{catalog.length}</strong> 演示案例</span>
              <span><strong>{completedCount || "缓存"}</strong> 历史报告</span>
              <span><strong>4</strong> 漏洞教程</span>
            </div>
          </div>

          <div className="attack-path-visual" aria-label="攻击路径图">
            <div className="path-rail" />
            {attackPath.map((node, index) => {
              const Icon = node.icon;
              return (
                <div className={`path-node path-node-${node.tone}`} key={node.en} style={{ gridColumn: index + 1 }}>
                  <span className="path-node-step">0{index + 1}</span>
                  <span className="path-node-icon"><Icon size={19} /></span>
                  <strong>{node.zh}</strong>
                  <small>{node.en}</small>
                  <em>{node.desc}</em>
                </div>
              );
            })}
            <div className="path-note path-note-left"><CheckCircle2 size={15} /> 只看关键调用分支</div>
            <div className="path-note path-note-right"><ShieldCheck size={15} /> 区分工具事实与模型推理</div>
          </div>
        </section>

        <section className="demo-row" aria-label="缓存演示案例">
          <div className="section-kicker">
            <strong>缓存演示案例</strong>
            <span>直接打开已跑好的报告，不重新启动后端任务。</span>
          </div>
          <div className="demo-case-row">
            {catalog.slice(0, 4).map((item) => {
              const task = taskByDapp.get(item.name);
              return (
                <button className="demo-case-pill" key={item.name} onClick={() => openCachedDemo(item.name)} type="button">
                  <span>
                    <strong>{item.name}</strong>
                    <small>{getCaseLabel(item, task)}</small>
                  </span>
                  <Play size={15} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="tutorial-section" id="vuln-tutorial">
          <div className="section-kicker">
            <strong>漏洞新手教程</strong>
            <span>不是背术语，而是按“背景直觉 → 攻击步骤 → 链上证据 → 练习路径”学习。</span>
          </div>
          <div className="tutorial-board">
            <div className="tutorial-list">
              {vulnerabilityLessons.map((item) => (
                <button
                  className={`tutorial-tab ${item.titleEn === selectedVuln.titleEn ? "tutorial-tab-active" : ""}`}
                  key={item.titleEn}
                  onClick={() => setActiveVuln(item.titleEn)}
                  type="button"
                >
                  <strong>{item.titleZh}</strong>
                  <small>{item.titleEn}</small>
                  <span>{item.beginnerHook}</span>
                </button>
              ))}
            </div>

            <article className="tutorial-detail">
              <div className="tutorial-title">
                <Library size={21} />
                <div>
                  <strong>{selectedVuln.titleZh}</strong>
                  <small>{selectedVuln.titleEn}</small>
                </div>
              </div>
              <p className="tutorial-hook">{selectedVuln.beginnerHook}</p>
              <div className="tutorial-block">
                <span>1. 背景直觉</span>
                <p>{selectedVuln.mentalModel}</p>
              </div>
              <div className="tutorial-columns">
                <div className="tutorial-block">
                  <span>2. 攻击者怎么做</span>
                  <ol>{selectedVuln.attackSteps.map((step) => <li key={step}>{step}</li>)}</ol>
                </div>
                <div className="tutorial-block">
                  <span>3. TracePilot 怎么查</span>
                  <ol>{selectedVuln.traceChecklist.map((step) => <li key={step}>{step}</li>)}</ol>
                </div>
              </div>
              <div className="tutorial-practice">
                <BookOpen size={17} />
                <span>{selectedVuln.practice}</span>
              </div>
            </article>
          </div>
        </section>
      </Content>
    </Layout>
  );
};

export default LandingWarRoom;