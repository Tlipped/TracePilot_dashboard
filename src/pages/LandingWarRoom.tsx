import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { App as AntdApp, Button, Input, Layout, Space, Tag, Typography } from "antd";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Coins,
  Database,
  ExternalLink,
  GitBranch,
  KeyRound,
  Library,
  Play,
  Repeat2,
  Scale,
  Search,
  ShieldCheck,
  Signature,
  TrendingUp,
  WalletCards,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { listDapps, listTasks, listVulnerabilityKnowledge, reviewTransaction, startTransactionDeepAnalysis } from "../services/api";
import { DappCatalogItem, Task, TaskStatus, TxReviewResponse, VulnerabilityTypeKnowledge } from "../types";
import riskPilotLogo from "../assets/riskpilot_logo.png";

const { Header, Content } = Layout;

// 首页缓存案例在这里改；名称需要和后端 /api/dapps 返回的 DApp name 一致。
const demoCases = ["ApeCoin (APE)", "SushiSwap", "Balancer"];

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
type VulnerabilityLesson = {
  titleZh: string;
  titleEn: string;
  icon: LucideIcon;
  beginnerHook: string;
  mentalModel: string;
  attackSteps: string[];
  traceChecklist: string[];
  repairHints?: string[];
  practice: string;
};

const vulnerabilityIconMap: Record<string, LucideIcon> = {
  oracle_manipulation: TrendingUp,
  reentrancy: Repeat2,
  accounting_drift: Scale,
  access_control: KeyRound,
  flash_loan_amplifier: Zap,
  signature_replay: Signature,
  precision_rounding: Scale,
  business_logic: AlertTriangle,
};

function nonEmptyList(primary?: string[], fallback?: string[]) {
  if (primary && primary.length > 0) return primary;
  if (fallback && fallback.length > 0) return fallback;
  return [];
}

function toVulnerabilityLesson(item: VulnerabilityTypeKnowledge): VulnerabilityLesson {
  const practice = item.practice_sources && item.practice_sources.length > 0
    ? item.practice_sources
        .map((source) => `${source.name}${source.hint ? `：${source.hint}` : ""}`)
        .join(" / ")
    : item.tracepilot_usage || "结合真实攻击复盘，在 AttackPilot 中对照交易、调用和证据链。";

  return {
    titleZh: item.name_zh,
    titleEn: item.name_en,
    icon: vulnerabilityIconMap[item.id] ?? Library,
    beginnerHook: item.one_liner || item.tracepilot_usage || item.name_zh,
    mentalModel: item.mental_model || item.one_liner || item.tracepilot_usage || "先理解协议相信了什么，再看攻击者如何打破这个假设。",
    attackSteps: nonEmptyList(item.attack_steps, item.why_it_happens),
    traceChecklist: nonEmptyList(item.trace_signals, item.repair_hints),
    repairHints: item.repair_hints ?? [],
    practice,
  };
}
const fallbackVulnerabilityLessons: VulnerabilityLesson[] = [
  {
    titleZh: "预言机操纵",
    titleEn: "Oracle Manipulation",
    icon: TrendingUp,
    beginnerHook: "如果协议用一个容易被临时推高或压低的价格做决策，攻击者就能在同一笔交易里先改价格，再薅协议。",
    mentalModel: "把 AMM 池想成一个临时秤。秤上的代币比例会影响价格，如果池子很浅，攻击者用大额 swap 就能短暂把秤拨歪。脆弱协议如果刚好相信这个秤，就会算错抵押、兑换或赎回价值。",
    attackSteps: ["借入闪电贷，获得足够大的临时资金。", "对低流动性池子做大额 swap，短暂扭曲价格。", "调用受害协议中依赖该价格的函数，例如 borrow、redeem、mint。", "反向交易恢复价格，归还闪电贷，留下套利收益。"],
    traceChecklist: ["获利动作前是否有异常大额 swap。", "同一交易内 reserve、price、exchange rate 是否剧烈变化。", "受害合约是否直接读取 AMM spot price。", "利润是否来自被错误估值的借款、铸造或赎回。"],
    practice: "先看 DeFiHackLabs 中 price/oracle 类攻击复现，再用 AttackPilot 对照交易调用和资金流。",
  },
  {
    titleZh: "重入攻击",
    titleEn: "Reentrancy",
    icon: Repeat2,
    beginnerHook: "合约还没把账记完，就把控制权交给别人；别人趁机又回来，重复领钱。",
    mentalModel: "把协议想成柜台。正常流程应该是先登记余额减少，再把钱转出去。重入漏洞的问题是柜台先把钱递出去，攻击者拿到钱的一瞬间又冲回柜台，说自己余额还在。",
    attackSteps: ["攻击合约调用 withdraw、claim 或 callback 类函数。", "受害合约先进行外部转账或回调。", "攻击合约在回调里再次调用受害函数。", "受害合约仍读取旧余额，导致重复提现。"],
    traceChecklist: ["调用树中是否出现同一函数或同一合约的嵌套调用。", "外部 call 是否发生在余额扣减之前。", "同一地址是否多次收到资产转出。", "是否缺少 reentrancy guard 或状态锁。"],
    practice: "先做 Ethernaut Reentrance 关卡，再看 DeFiHackLabs 真实重入案例。",
  },
  {
    titleZh: "会计偏移",
    titleEn: "Accounting Drift",
    icon: Scale,
    beginnerHook: "协议账本里记录的份额或汇率，和真实资产余额对不上，攻击者把这个差价变成收益。",
    mentalModel: "很多金库会用 share 表示你拥有多少份资产。问题出在 asset 和 share 的换算，如果有人能改变真实余额却不改变份额，或者利用舍入边界，就会让兑换比例失真。",
    attackSteps: ["把池子或金库推到极端状态，例如低份额、低余额或高汇率。", "通过 donation、mint、redeem 或 borrow 制造账面偏差。", "在错误汇率下兑换、赎回或借款。", "把内部账本偏差兑现成真实资产。"],
    traceChecklist: ["asset balance、share supply、exchange rate 是否突然跳变。", "关键函数前后是否出现 donation 或非标准转账。", "计算中是否存在向下或向上舍入导致的边界收益。", "协议是否缺少最小流动性或汇率变化限制。"],
    practice: "重点整理 vault、lending、share price 类案例，把攻击前后的不变量写出来。",
  },
  {
    titleZh: "权限控制缺陷",
    titleEn: "Access Control",
    icon: KeyRound,
    beginnerHook: "不该有钥匙的人打开了管理员门。",
    mentalModel: "升级、铸币、暂停、设置预言机、修改策略都属于高危权限。如果函数没有检查调用者身份，或者初始化/签名逻辑有洞，攻击者不需要复杂数学，直接改规则。",
    attackSteps: ["找到缺少 onlyOwner、role 或 signature 检查的敏感函数。", "直接调用特权分支，或初始化未初始化合约。", "修改价格源、策略地址、铸币权限或资金出口。", "转移资产或让协议进入攻击者控制的状态。"],
    traceChecklist: ["调用者是否真的拥有 owner/role 权限。", "函数是否会修改全局参数或资金控制权。", "签名是否校验 nonce、deadline、chain id。", "代理合约或初始化函数是否被二次初始化。"],
    practice: "先做 Ethernaut 中 owner、delegatecall、preservation 类关卡，再回看真实权限事故。",
  },
  {
    titleZh: "闪电贷放大",
    titleEn: "Flash Loan Amplifier",
    icon: Zap,
    beginnerHook: "闪电贷本身不是漏洞，它像放大镜，把很小的协议假设错误放大成一次可盈利攻击。",
    mentalModel: "攻击者不用自带巨额本金，只要在同一笔交易里借钱、利用漏洞、还钱即可。真正危险的不是借钱，而是协议允许临时资金改变价格、份额、投票权或清算条件。",
    attackSteps: ["从借贷协议借入大量临时资产。", "用临时资产改变目标协议的关键状态。", "在状态被扭曲时执行获利动作。", "还清闪电贷，把剩余资产作为利润带走。"],
    traceChecklist: ["交易开头是否有 flashLoan、borrow、swap 类资金入口。", "借入资产是否被用于影响价格、流动性或抵押状态。", "获利和归还是否发生在同一笔交易。", "如果去掉闪电贷，漏洞是否仍然存在但规模变小。"],
    practice: "把 DeFiHackLabs 中带 flashloan 的案例按“借入 -> 放大 -> 获利 -> 归还”四步重画一遍。",
  },
  {
    titleZh: "签名重放",
    titleEn: "Signature Replay",
    icon: Signature,
    beginnerHook: "一张旧授权如果没有过期、没有 nonce、没有链 ID 约束，攻击者可能拿它重复办事。",
    mentalModel: "签名像一张支票。安全支票要写收款人、金额、日期、编号和适用银行。如果少了编号或适用范围，别人可能复印这张支票，到别处或再次使用。",
    attackSteps: ["收集用户或管理员曾经签过的授权消息。", "检查签名是否缺少 nonce、deadline、domain separator 或 chainId。", "在同一合约、另一条链或另一份代理合约中复用签名。", "触发 permit、claim、withdraw 或 admin action。"],
    traceChecklist: ["签名参数里是否有 nonce/deadline/chainId。", "nonce 是否真的被消费并递增。", "domain separator 是否绑定合约地址和链。", "同一签名哈希是否多次出现。"],
    practice: "先补 EIP-712、permit、nonce 概念，再看签名授权类攻击复现。",
  },
  {
    titleZh: "精度与舍入错误",
    titleEn: "Precision / Rounding",
    icon: Scale,
    beginnerHook: "链上没有小数，所有小数都靠整数缩放模拟；舍入方向错了，就可能把零头变成利润。",
    mentalModel: "协议在计算份额、利息、手续费时经常做乘除法。每次除法都要舍入，向上舍入给谁、向下舍入给谁，会决定长期或边界情况下谁占便宜。",
    attackSteps: ["找到金额很小、份额很少或汇率极端的边界状态。", "重复执行 mint/redeem/swap，让舍入误差累积。", "利用精度损失让协议少扣、多发或错误判断阈值。", "把累计误差兑换成真实资产。"],
    traceChecklist: ["关键计算是否有除法、缩放因子或 decimal 转换。", "攻击交易是否重复执行同类小额操作。", "份额、余额或债务是否出现不成比例变化。", "代码是否明确使用向上或向下舍入。"],
    practice: "把 vault share、AMM swap、fee accounting 的公式手算一遍，再对照 trace 中的实际数值。",
  },
  {
    titleZh: "业务逻辑漏洞",
    titleEn: "Business Logic",
    icon: AlertTriangle,
    beginnerHook: "代码没有报错，但协议规则本身被绕过了。",
    mentalModel: "很多 DeFi 攻击不是传统 bug，而是流程设计有洞：先后顺序不对、状态检查漏了、假设用户会诚实操作、或者多个模块组合后产生了意外路径。",
    attackSteps: ["找到协议文档或正常业务流程中的关键约束。", "构造一个不按正常顺序走的交易路径。", "让某个检查在旧状态、错误状态或缺失状态下通过。", "利用通过后的状态执行获利动作。"],
    traceChecklist: ["攻击路径是否绕过了正常 deposit/withdraw/settle 顺序。", "是否存在先使用后验证、先转账后结算的流程。", "多个合约组合时是否丢失了某个前置条件。", "最终利润是否来自规则漏洞而不是单行代码错误。"],
    practice: "读案例时先画正常流程，再画攻击流程，两条路径差异就是漏洞入口。",
  },
];

function normalizeCaseName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getCaseLabel(item: DappCatalogItem, task?: Task) {
  if (task?.status === TaskStatus.COMPLETED) return "已完成分析 / Cached report";
  if (task?.status === TaskStatus.RUNNING) return "正在分析 / Running";
  const txText = item.transaction_count > 0 ? `${item.transaction_count} 笔交易` : "案例";
  const cause = item.cause || item.root_cause || item.platform || "链上风险";
  return `${txText} / ${cause}`;
}


const defaultPatchHints = [
  "先写清楚漏洞成立的不变量，例如价格不能只看单点、余额扣减必须早于外部调用。",
  "把检查放在最小修复点上，避免直接禁用正常入口或破坏 ABI / storage layout。",
  "用原始 PoC、变体 PoC 和历史正常交易一起回归，确认不是只让脚本 revert。",
];
const learningLinks = [
  { label: "Ethernaut", href: "https://ethernaut.openzeppelin.com/", desc: "Solidity / EVM 闯关练习" },
  { label: "DeFiHackLabs", href: "https://github.com/SunWeb3Sec/DeFiHackLabs", desc: "真实 DeFi 攻击复现" },
];

const sampleAttackHash = "0xeb8c3bebed11e2e4fcd30cbfc2fb3c55c4ca166003c7f7d319e78eaab9747098";

function getRiskTagColor(level: string) {
  if (level === "high") return "red";
  if (level === "medium") return "orange";
  if (level === "low") return "green";
  return "gold";
}

function getRiskText(level: string) {
  if (level === "high") return "高风险线索";
  if (level === "medium") return "可疑线索";
  if (level === "low") return "低风险/信息";
  return "待取证";
}

const LandingWarRoom: React.FC = () => {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const [catalog, setCatalog] = useState<DappCatalogItem[]>(fallbackCatalog);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [vulnerabilityLessons, setVulnerabilityLessons] = useState<VulnerabilityLesson[]>(fallbackVulnerabilityLessons);
  const [activeVuln, setActiveVuln] = useState(fallbackVulnerabilityLessons[0].titleEn);
  const [knowledgeSource, setKnowledgeSource] = useState<"api" | "fallback">("fallback");
  const [txHash, setTxHash] = useState(sampleAttackHash);
  const [txReview, setTxReview] = useState<TxReviewResponse | null>(null);
  const [txReviewLoading, setTxReviewLoading] = useState(false);
  const [deepAnalysisLoading, setDeepAnalysisLoading] = useState(false);

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

    listVulnerabilityKnowledge()
      .then((response) => {
        if (cancelled) return;
        const lessons = response.items.map(toVulnerabilityLesson).filter((item) => item.attackSteps.length > 0);
        if (lessons.length === 0) return;
        setVulnerabilityLessons(lessons);
        setKnowledgeSource("api");
        setActiveVuln((current) => lessons.some((item) => item.titleEn === current) ? current : lessons[0].titleEn);
      })
      .catch(() => setKnowledgeSource("fallback"));

    return () => {
      cancelled = true;
    };
  }, []);

  const taskByDapp = useMemo(() => {
    const map = new Map<string, Task>();
    for (const name of demoCases) {
      const targetName = normalizeCaseName(name);
      const sameName = tasks.filter((task) => normalizeCaseName(task.dapp_name) === targetName);
      const preferred =
        sameName.find((task) => task.status === TaskStatus.COMPLETED && !task.archived) ??
        sameName.find((task) => task.status === TaskStatus.COMPLETED) ??
        sameName.find((task) => !task.archived) ??
        sameName[0];
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
    [activeVuln, vulnerabilityLessons],
  );

  const openCachedDemo = useCallback(
    (dappName: string) => {
      const targetName = normalizeCaseName(dappName);
      const task =
        taskByDapp.get(dappName) ??
        tasks.find((item) => normalizeCaseName(item.dapp_name) === targetName && item.status === TaskStatus.COMPLETED && !item.archived) ??
        tasks.find((item) => normalizeCaseName(item.dapp_name) === targetName && item.status === TaskStatus.COMPLETED) ??
        tasks.find((item) => normalizeCaseName(item.dapp_name) === targetName && !item.archived) ??
        tasks.find((item) => normalizeCaseName(item.dapp_name) === targetName);
      if (!task) {
        message.warning("这个案例还没有缓存任务，请先到任务库查看已有报告，或手动启动一次分析。");
        navigate("/tasks");
        return;
      }
      navigate(`/tasks/${task.task_id}`);
    },
    [message, navigate, taskByDapp, tasks],
  );

  const handleTxReview = useCallback(async () => {
    const value = txHash.trim();
    if (!value) {
      message.warning("先粘贴一笔交易 Hash。");
      return;
    }

    setTxReviewLoading(true);
    try {
      const result = await reviewTransaction({ tx_hash: value, chain: "ethereum" });
      setTxReview(result);
      if (result.tx_type === "known_attack_case") {
        message.success("命中本地攻击案例库，可以直接查看复盘结果。");
      } else {
        message.info("未命中本地攻击库，需要进一步链上取证。");
      }
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail || "交易 Hash 审查失败，请检查后端服务。");
    } finally {
      setTxReviewLoading(false);
    }
  }, [message, txHash]);

  const handleStartDeepAnalysis = useCallback(async () => {
    const value = txHash.trim();
    if (!value) {
      message.warning("先粘贴一笔交易 Hash。");
      return;
    }

    setDeepAnalysisLoading(true);
    try {
      const task = await startTransactionDeepAnalysis({ tx_hash: value, chain: "ethereum" });
      message.success("深度分析任务已启动。");
      navigate(`/tasks/${task.task_id}`);
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      message.error(detail || "启动深度分析失败，请检查后端服务。");
    } finally {
      setDeepAnalysisLoading(false);
    }
  }, [message, navigate, txHash]);

  const scrollToSection = useCallback((sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <Layout className="landing-v2">
      <Header className="landing-v2-nav">
        <button className="landing-brand" type="button" onClick={() => navigate("/") }>
          <span className="landing-brand-mark"><img src={riskPilotLogo} alt="RiskPilot logo" /></span>
          <span><strong>AttackPilot</strong><small>Exploit review cockpit</small></span>
        </button>
        <Space size={10} className="landing-nav-actions">
          <Button type="text" onClick={() => scrollToSection("tx-review")}>交易审查</Button>
          <Button type="text" onClick={() => navigate("/tasks")}>任务库</Button>
          <Button type="text" onClick={() => document.getElementById("vuln-tutorial")?.scrollIntoView({ behavior: "smooth" })}>漏洞教程</Button>
          <Button type="primary" icon={<Play size={15} />} onClick={() => openCachedDemo("ApeCoin (APE)")}>打开缓存案例</Button>
        </Space>
      </Header>

      <Content className="landing-v2-content">
        <section className="landing-stage">
          <div className="stage-watermark"><img src={riskPilotLogo} alt="" aria-hidden="true" /></div>
          <div className="stage-copy">
            <Tag className="stage-chip">链上攻击审查</Tag>
            <Typography.Title className="stage-title">AttackPilot</Typography.Title>
            <Typography.Title level={2} className="stage-subtitle">输入一笔可疑交易，自动复盘攻击路径，定位漏洞原因。</Typography.Title>
            <Typography.Paragraph className="stage-desc">
              系统会先查已有攻击案例，再根据链上证据启动深度分析。
            </Typography.Paragraph>
            <div className="stage-facts">
              <button type="button" onClick={() => scrollToSection("quick-cases")}><strong>{catalog.length}</strong> 案例库</button>
              <button type="button" onClick={() => navigate("/tasks")}><strong>{completedCount || "缓存"}</strong> 历史报告</button>
              <button type="button" onClick={() => scrollToSection("vuln-tutorial")}><strong>{vulnerabilityLessons.length}</strong> 漏洞教程</button>
            </div>
          </div>

          <div className="hero-action-panel" id="tx-review" aria-label="交易 Hash 审查">
            <div className="hero-action-title">
              <span>开始审查</span>
              <strong>粘贴交易 Hash</strong>
            </div>
            <div className="tx-review-input-row">
              <Input
                className="tx-review-input"
                value={txHash}
                onChange={(event) => setTxHash(event.target.value)}
                onPressEnter={handleTxReview}
                placeholder="Ethereum 交易 Hash，例如 0x..."
                allowClear
              />
              <Button type="primary" icon={<Search size={15} />} loading={txReviewLoading} onClick={handleTxReview}>
                开始审查
              </Button>
            </div>
            <div className="hero-action-hint">
              <Button type="link" onClick={() => setTxHash(sampleAttackHash)}>填入示例 Hash</Button>
              <span>支持命中案例、线索分诊和深度分析任务创建。</span>
            </div>

            <div className="quick-case-strip" id="quick-cases">
              <span>快速打开</span>
              <div>
                {catalog.slice(0, 3).map((item) => {
                  const task = taskByDapp.get(item.name);
                  return (
                    <button className="quick-case-chip" key={item.name} onClick={() => openCachedDemo(item.name)} type="button">
                      <strong>{item.name}</strong>
                      <small>{getCaseLabel(item, task)}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="tx-review-section" aria-label="交易审查结果">
          <div className="section-kicker tx-review-kicker">
            <div>
              <strong>审查结果</strong>
              <span>系统会把结果整理成下一步队列。</span>
            </div>
            <Tag className="tx-review-mode">案例命中 / 链上取证</Tag>
          </div>

          <div className="tx-review-panel">
            {txReview ? (
              <div className="tx-review-result">
                <div className="tx-review-result-main">
                  <Tag color={getRiskTagColor(txReview.risk_level)}>
                    {txReview.tx_type === "known_attack_case" ? "已知攻击案例" : getRiskText(txReview.risk_level)}
                  </Tag>
                  <strong>{txReview.summary}</strong>
                  <small>{txReview.tx_hash}</small>
                </div>

                <div className="tx-review-queue">
                  <div className="tx-step-card tx-step-primary">
                    <span>P1</span>
                    <strong>{txReview.tx_type === "known_attack_case" ? "打开已知案例" : "启动链上取证"}</strong>
                    <p>
                      {txReview.tx_type === "known_attack_case"
                        ? `已命中 ${txReview.matched_cases[0]?.name || "本地攻击案例"}，可以直接查看复盘报告。`
                        : "本地案例库未命中，需要拉取交易详情、trace、事件日志和资金变化。"}
                    </p>
                    {txReview.matched_cases.length > 0 ? (
                      <div className="tx-review-actions">
                        <Button size="small" onClick={() => openCachedDemo(txReview.matched_cases[0].name)}>打开复盘工作区</Button>
                        <Button size="small" type="primary" loading={deepAnalysisLoading} onClick={handleStartDeepAnalysis}>重新深度分析</Button>
                      </div>
                    ) : (
                      <Button size="small" type="primary" loading={deepAnalysisLoading} onClick={handleStartDeepAnalysis}>启动深度分析</Button>
                    )}
                  </div>
                  <div className="tx-step-card">
                    <span>P2</span>
                    <strong>查看审查信号</strong>
                    <p>
                      {txReview.signal_details?.length
                        ? txReview.signal_details.slice(0, 3).map((signal) => signal.name).join(" / ")
                        : txReview.signals.slice(0, 3).join(" / ")}
                    </p>
                  </div>
                  <div className="tx-step-card">
                    <span>P3</span>
                    <strong>核对证据来源</strong>
                    <p>{txReview.evidence.map((item) => `${item.title}：${item.source}`).join(" / ")}</p>
                  </div>
                </div>

                {txReview.signal_details?.length > 0 ? (
                  <div className="tx-signal-list">
                    {txReview.signal_details.map((signal) => (
                      <div className={`tx-signal-item tx-signal-${signal.level}`} key={signal.id}>
                        <Tag color={getRiskTagColor(signal.level)}>{getRiskText(signal.level)}</Tag>
                        <strong>{signal.name}</strong>
                        <p>{signal.summary}</p>
                        <small>{signal.evidence}</small>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="tx-review-empty">
                输入交易 Hash 后，这里会显示案例命中、审查信号和下一步操作。
              </div>
            )}
          </div>
        </section>

        <section className="attack-flow-section" aria-label="攻击路径图">
          <div className="section-kicker">
            <strong>它如何复盘攻击</strong>
            <span>从交易入口到获利出口，逐步还原攻击链路。</span>
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
            <div className="path-note path-note-left"><CheckCircle2 size={15} /> 聚焦关键调用分支</div>
            <div className="path-note path-note-right"><ShieldCheck size={15} /> 区分链上事实与模型推理</div>
          </div>
        </section>

        <section className="tutorial-section" id="vuln-tutorial">
          <div className="section-kicker tutorial-kicker">
            <div>
              <strong>漏洞新手教程</strong>
              <span>不是背术语，而是按“背景直觉 → 攻击步骤 → 链上证据 → 练习路径”学习。</span>
            </div>
            <div className="learning-links">
              <span className="knowledge-source">{knowledgeSource === "api" ? "知识库同步" : "本地内容"}</span>
              {learningLinks.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                  <span><strong>{link.label}</strong><small>{link.desc}</small></span>
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </div>
          <div className="tutorial-board">
            <div className="tutorial-list">
              {vulnerabilityLessons.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    className={`tutorial-tab ${item.titleEn === selectedVuln.titleEn ? "tutorial-tab-active" : ""}`}
                    key={item.titleEn}
                    onClick={() => setActiveVuln(item.titleEn)}
                    type="button"
                  >
                    <span className="tutorial-tab-icon"><Icon size={16} /></span>
                    <strong>{item.titleZh}</strong>
                    <small>{item.titleEn}</small>
                    <span>{item.beginnerHook}</span>
                  </button>
                );
              })}
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
                  <span>3. AttackPilot 怎么查</span>
                  <ol>{selectedVuln.traceChecklist.map((step) => <li key={step}>{step}</li>)}</ol>
                </div>
              </div>
              <div className="tutorial-bottom-grid">
                <div className="tutorial-note">
                  <span>PoC 是什么</span>
                  <p>PoC（Proof of Concept）就是“最小攻击复现”：用一段脚本或一笔交易证明漏洞真的能被触发。看 PoC 不是为了照抄攻击，而是为了确认漏洞成立需要哪些前提。</p>
                </div>
                <div className="tutorial-block tutorial-patch">
                  <span>4. 一般怎么打补丁</span>
                  <ol>{(selectedVuln.repairHints?.length ? selectedVuln.repairHints : defaultPatchHints).map((step) => <li key={step}>{step}</li>)}</ol>
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
