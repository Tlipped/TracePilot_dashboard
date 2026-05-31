import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Layout, Space, Tag, Typography } from "antd";
import { ArrowLeft, Bot, Braces, CheckCircle2, Database, FileSearch, GitBranch, ShieldCheck, Sparkles, Wrench } from "lucide-react";

const { Header, Content } = Layout;

const valueCards = [
  { title: "Problem", text: "After a DeFi exploit, teams need to know the key transaction, vulnerable logic, and evidence quality quickly.", icon: ShieldCheck },
  { title: "Input", text: "Select a real incident case or start analysis from a DApp / transaction hash.", icon: Database },
  { title: "Output", text: "Attack path, fund flow, critical call, root cause, evidence chain, and repair advice.", icon: FileSearch },
  { title: "Innovation", text: "Multi-agent workflow with dynamic trace expansion and structured evidence review.", icon: GitBranch },
];

const skillItems = [
  ["list_dapps", "List analyzable on-chain risk cases"],
  ["create_task", "Start an exploit localization task"],
  ["get_task", "Read task status and final report"],
  ["get_macro_analysis", "Read transaction and attack-path summary"],
  ["get_automated_review", "Generate evidence review preview"],
  ["get_task_logs", "Trace agent reasoning logs"],
];

const Briefing: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Layout className="war-room-shell briefing-shell">
      <Header className="war-room-nav">
        <Space size={10}>
          <Button icon={<ArrowLeft size={16} />} onClick={() => navigate("/")} />
          <Typography.Text className="war-room-brand">TracePilot Briefing</Typography.Text>
        </Space>
        <Space>
          <Button onClick={() => navigate("/tasks")}>Tasks</Button>
          <Button type="primary" onClick={() => navigate("/")}>Cockpit</Button>
        </Space>
      </Header>
      <Content className="briefing-content">
        <section className="briefing-hero">
          <Tag className="hero-chip" icon={<Sparkles size={13} />}>On-chain risk governance / Agent Skill / Human App</Tag>
          <Typography.Title>TracePilot: evidence-backed exploit localization agent</Typography.Title>
          <Typography.Paragraph>
            TracePilot turns exploit review into a reproducible workflow: collect on-chain facts, inspect traces, locate vulnerable logic, and present a reviewable evidence chain.
          </Typography.Paragraph>
        </section>

        <section className="briefing-card-grid">
          {valueCards.map((card) => {
            const Icon = card.icon;
            return (
              <div className="briefing-card" key={card.title}>
                <Icon size={24} />
                <strong>{card.title}</strong>
                <span>{card.text}</span>
              </div>
            );
          })}
        </section>

        <section className="briefing-two-col">
          <div className="briefing-block">
            <Typography.Title level={3}>Roadshow order</Typography.Title>
            <ol className="briefing-steps">
              <li><strong>Open with one incident</strong><span>An alert says money is gone, but the team still needs root cause and evidence.</span></li>
              <li><strong>Enter the cockpit</strong><span>Select APE / BNO and show the attack review flow.</span></li>
              <li><strong>Explain agent roles</strong><span>Collection, trace, localization, evidence review, remediation.</span></li>
              <li><strong>End with report</strong><span>Root cause, key evidence, repair hint, and traceable logs.</span></li>
            </ol>
          </div>
          <div className="briefing-block skill-block">
            <Typography.Title level={3}>ArkClaw Skill</Typography.Title>
            <div className="skill-list">
              {skillItems.map(([name, desc], index) => (
                <div className="skill-item" key={name}>
                  <span>{index + 1}</span>
                  <code>{name}</code>
                  <small>{desc}</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="briefing-pitch">
          <div><Bot size={28} /><strong>Positioning</strong><span>TracePilot is a reviewable on-chain risk analysis workflow, not just a report generator.</span></div>
          <div><Braces size={28} /><strong>Stack</strong><span>FastAPI, React, WebSocket logs, Postgres persistence, multi-agent analysis, and Skill API.</span></div>
          <div><Wrench size={28} /><strong>Next</strong><span>Add vulnerability knowledge base, similar-case retrieval, error classification, and cached demos.</span></div>
          <div><CheckCircle2 size={28} /><strong>Trust</strong><span>Separate tool facts, transaction evidence, and model inference to reduce hallucination risk.</span></div>
        </section>
      </Content>
    </Layout>
  );
};

export default Briefing;