import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Input, Select, Space, Tag, Tooltip, Typography } from "antd";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ChevronDown,
  CirclePause,
  CirclePlay,
  Code2,
  FileText,
  Search,
  TerminalSquare,
  Wrench,
} from "lucide-react";
import { LogLevel, LogMessage, MsgType, TaskEvent } from "../types";
import MarkdownRenderer from "./MarkdownRenderer";

interface LogStreamProps {
  events: TaskEvent[];
  selectedAgent: string | "all";
  onSelectLog: (log: LogMessage) => void;
}

function isLogEvent(event: TaskEvent): event is LogMessage {
  return event.type === "LOG";
}

function getLevelClass(level: LogLevel) {
  if (level === LogLevel.ERROR) return "level-error";
  if (level === LogLevel.WARNING) return "level-warning";
  if (level === LogLevel.DEBUG) return "level-debug";
  return "level-info";
}

function getTypeIcon(type: MsgType) {
  if (type === MsgType.TOOL_CALL) return <Wrench size={14} />;
  if (type === MsgType.RESULT) return <CheckCircle2 size={14} />;
  if (type === MsgType.MARKDOWN) return <FileText size={14} />;
  return <TerminalSquare size={14} />;
}

function formatTime(timestamp?: string) {
  if (!timestamp) return "--:--:--";
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getControlText(event: TaskEvent) {
  if (event.type === "TASK_STATUS") return `Task status changed to ${event.status}`;
  if (event.type === "TASK_FINAL") return `Task finished as ${event.status}`;
  if (event.type === "LOG_DROPPED") return `${event.count} log messages were dropped due to backpressure`;
  if (event.type === "CONNECTED") return event.message;
  if (event.type === "HEARTBEAT_TIMEOUT") return event.message;
  return "";
}

const LogStream: React.FC<LogStreamProps> = ({ events, selectedAgent, onSelectLog }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<"all" | LogLevel>("all");
  const [messageType, setMessageType] = useState<"all" | MsgType>("all");

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      if (isLogEvent(event)) {
        if (selectedAgent !== "all" && event.agent !== selectedAgent) return false;
        if (level !== "all" && event.level !== level) return false;
        if (messageType !== "all" && event.message_type !== messageType) return false;
        if (normalizedQuery) {
          const haystack = `${event.agent} ${event.level} ${event.message_type} ${event.message}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        }
        return true;
      }

      if (selectedAgent !== "all") return false;
      if (normalizedQuery) return getControlText(event).toLowerCase().includes(normalizedQuery);
      return true;
    });
  }, [events, level, messageType, query, selectedAgent]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [autoScroll, filteredEvents.length]);

  return (
    <section className="stream-panel">
      <div className="stream-toolbar">
        <Space size={8} wrap>
          <Input
            allowClear
            className="stream-search"
            prefix={<Search size={14} />}
            placeholder="Search logs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Select
            size="middle"
            value={level}
            onChange={setLevel}
            options={[
              { label: "All levels", value: "all" },
              { label: "Info", value: LogLevel.INFO },
              { label: "Warning", value: LogLevel.WARNING },
              { label: "Error", value: LogLevel.ERROR },
              { label: "Debug", value: LogLevel.DEBUG },
            ]}
          />
          <Select
            size="middle"
            value={messageType}
            onChange={setMessageType}
            options={[
              { label: "All types", value: "all" },
              { label: "Text", value: MsgType.TEXT },
              { label: "Markdown", value: MsgType.MARKDOWN },
              { label: "Tool", value: MsgType.TOOL_CALL },
              { label: "Result", value: MsgType.RESULT },
            ]}
          />
        </Space>
        <Tooltip title={autoScroll ? "Pause auto scroll" : "Resume auto scroll"}>
          <Button
            icon={autoScroll ? <CirclePause size={15} /> : <CirclePlay size={15} />}
            onClick={() => setAutoScroll((value) => !value)}
          />
        </Tooltip>
      </div>

      <div ref={scrollRef} className="log-stream">
        {filteredEvents.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching events" />
        ) : (
          filteredEvents.map((event, index) => {
            if (!isLogEvent(event)) {
              const isWarning = event.type === "LOG_DROPPED" || event.type === "HEARTBEAT_TIMEOUT";
              return (
                <div key={`${event.type}-${index}`} className={isWarning ? "control-event warning" : "control-event"}>
                  {isWarning ? <AlertTriangle size={14} /> : <ChevronDown size={14} />}
                  <span>{getControlText(event)}</span>
                </div>
              );
            }

            const contentPreview = event.message.length > 900 ? `${event.message.slice(0, 900)}...` : event.message;
            return (
              <button
                key={`${event.timestamp}-${event.agent}-${index}`}
                className={`log-event ${getLevelClass(event.level)}`}
                onClick={() => onSelectLog(event)}
                type="button"
              >
                <div className="log-event-meta">
                  <span className="log-time">{formatTime(event.timestamp)}</span>
                  <Tag className="agent-tag">{event.agent}</Tag>
                  <Tag className={`level-tag ${getLevelClass(event.level)}`}>{event.level}</Tag>
                  <span className="message-type">
                    {getTypeIcon(event.message_type)}
                    {event.message_type}
                  </span>
                  {event.is_truncated ? <Tag color="warning">truncated</Tag> : null}
                  {event.level === LogLevel.ERROR ? <Bug size={14} className="text-red" /> : null}
                </div>
                <div className="log-event-body">
                  {event.message_type === MsgType.MARKDOWN || event.message_type === MsgType.RESULT ? (
                    <MarkdownRenderer content={contentPreview} compact />
                  ) : (
                    <Typography.Text>{contentPreview}</Typography.Text>
                  )}
                </div>
                {event.message_type === MsgType.TOOL_CALL ? (
                  <div className="tool-hint">
                    <Code2 size={13} />
                    Tool call event
                  </div>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
};

export default LogStream;
