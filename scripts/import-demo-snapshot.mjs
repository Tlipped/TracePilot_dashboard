import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const snapshotsPath = path.join(root, "src", "data", "demoSnapshots.json");
const demoLogsDir = path.join(root, "public", "demo-logs");
const MAX_LOG_PAGES = 5;
const MAX_FULL_LOG_CHARS = 200_000;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Import an existing completed task as an offline demo snapshot.

Usage:
  npm run demo:import -- --base-url http://127.0.0.1:8000 --task-id <uuid> [options]

Options:
  --id <slug>              Offline route id, defaults to a slug derived from the DApp name
  --name <name>            Display name override
  --max-full-logs <count>  Full log bodies to retain, defaults to 30
  --dry-run                Fetch and validate without writing files
  --help                   Show this help
`);
}

function requiredString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required option: --${label}`);
  }
  return value.trim();
}

function safeDemoId(value) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(normalized)) {
    throw new Error("Demo id must resolve to 2-64 lowercase letters, digits, underscores, or hyphens.");
  }
  return normalized;
}

function redactText(value) {
  return value
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi, "[REDACTED PRIVATE KEY]")
    .replace(/\bsk-[a-z0-9_-]{16,}\b/gi, "sk-[REDACTED]")
    .replace(/\bBearer\s+[a-z0-9._~+/=-]{12,}\b/gi, "Bearer [REDACTED]")
    .replace(
      /\b(api[_-]?key|secret|access[_-]?token)\s*[:=]\s*["']?([a-z0-9._~+/=-]{12,})["']?/gi,
      "$1=[REDACTED]",
    );
}

function sanitize(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitize(item)]));
  }
  return value;
}

function withTaskId(payload, taskId) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  return { ...payload, task_id: taskId };
}

async function requestJson(baseUrl, pathname, { optional = false } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Accept: "application/json" },
  });
  if (response.ok) return response.json();
  if (optional && response.status === 404) return null;
  const detail = await response.text();
  throw new Error(`${pathname} returned HTTP ${response.status}: ${detail.slice(0, 300)}`);
}

async function loadAllLogs(baseUrl, taskId) {
  let beforeId = null;
  let logs = [];
  for (let pageIndex = 0; pageIndex < MAX_LOG_PAGES; pageIndex += 1) {
    const params = new URLSearchParams({ limit: "1000" });
    if (beforeId != null) params.set("before_id", String(beforeId));
    const page = await requestJson(
      baseUrl,
      `/api/tasks/${encodeURIComponent(taskId)}/logs?${params.toString()}`,
    );
    logs = [...(page.events ?? []), ...logs];
    if (!page.has_more || page.next_before_id == null) break;
    beforeId = page.next_before_id;
  }
  return logs;
}

async function loadFullLogs(baseUrl, taskId, logs, maxCount) {
  const candidates = logs
    .filter((item) => item.log_id)
    .slice(-maxCount);
  const output = {};
  for (const item of candidates) {
    try {
      const result = await requestJson(
        baseUrl,
        `/api/task/${encodeURIComponent(taskId)}/log/${encodeURIComponent(item.log_id)}`,
        { optional: true },
      );
      if (result?.content) {
        output[item.log_id] = redactText(String(result.content).slice(0, MAX_FULL_LOG_CHARS));
      }
    } catch (error) {
      console.warn(`Skipped full log ${item.log_id}: ${error.message}`);
    }
  }
  return output;
}

async function loadAgentFiles(baseUrl, taskId) {
  const metadata = await requestJson(
    baseUrl,
    `/api/tasks/${encodeURIComponent(taskId)}/agent-log-files`,
    { optional: true },
  );
  if (!metadata?.files?.length) {
    return { agent_log_dir: metadata?.log_dir ?? null, agent_log_files: [] };
  }

  const files = [];
  for (const item of metadata.files.slice(0, 20)) {
    try {
      const file = await requestJson(
        baseUrl,
        `/api/tasks/${encodeURIComponent(taskId)}/agent-log-files/${encodeURIComponent(item.id)}?max_bytes=${MAX_FULL_LOG_CHARS}`,
        { optional: true },
      );
      if (file) files.push(sanitize(file));
    } catch (error) {
      console.warn(`Skipped agent file ${item.name}: ${error.message}`);
    }
  }
  return {
    agent_log_dir: metadata.log_dir ?? null,
    agent_log_files: files,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const baseUrl = requiredString(args["base-url"], "base-url").replace(/\/+$/, "");
  const sourceTaskId = requiredString(args["task-id"], "task-id");
  const maxFullLogs = Number.parseInt(String(args["max-full-logs"] ?? "30"), 10);
  if (!Number.isInteger(maxFullLogs) || maxFullLogs < 0 || maxFullLogs > 200) {
    throw new Error("--max-full-logs must be an integer between 0 and 200.");
  }

  const task = await requestJson(baseUrl, `/api/tasks/${encodeURIComponent(sourceTaskId)}`);
  if (!["completed", "failed"].includes(task.status)) {
    throw new Error(`Task ${sourceTaskId} is ${task.status}; only terminal tasks can become demo snapshots.`);
  }

  const displayName = String(args.name || task.dapp_name || "AttackPilot Demo").trim();
  const demoId = safeDemoId(String(args.id || `demo-${displayName}`));
  const [logs, macro, review, caseReview, agentFiles] = await Promise.all([
    loadAllLogs(baseUrl, sourceTaskId),
    requestJson(baseUrl, `/api/tasks/${encodeURIComponent(sourceTaskId)}/macro-analysis`, { optional: true }),
    requestJson(baseUrl, `/api/tasks/${encodeURIComponent(sourceTaskId)}/automated-review`, { optional: true }),
    requestJson(baseUrl, `/api/tasks/${encodeURIComponent(sourceTaskId)}/case-review`),
    loadAgentFiles(baseUrl, sourceTaskId),
  ]);
  const fullLogs = await loadFullLogs(baseUrl, sourceTaskId, logs, maxFullLogs);

  const capturedAt = new Date().toISOString();
  const snapshot = sanitize({
    id: demoId,
    source_task_id: sourceTaskId,
    captured_at: capturedAt,
    name: displayName,
    task: { ...task, task_id: demoId, archived: true },
    logs: logs.map((item) => ({ ...item, task_id: demoId })),
    macro: withTaskId(macro, demoId),
    review: withTaskId(review, demoId),
    case_review: withTaskId(caseReview, demoId),
  });
  const logPack = sanitize({
    demo_id: demoId,
    captured_at: capturedAt,
    full_logs: fullLogs,
    ...agentFiles,
    agent_log_files: agentFiles.agent_log_files.map((item) => ({
      ...item,
      task_id: demoId,
    })),
  });

  console.log(`Validated ${displayName}: ${logs.length} logs, ${caseReview.evidence?.length ?? 0} evidence items.`);
  if (args["dry-run"]) {
    console.log(`Dry run complete. Would write demo id "${demoId}".`);
    return;
  }

  const current = JSON.parse(fs.readFileSync(snapshotsPath, "utf8"));
  const cases = Array.isArray(current.cases) ? current.cases : [];
  const nextCases = [...cases.filter((item) => item.id !== demoId), snapshot];
  fs.mkdirSync(demoLogsDir, { recursive: true });
  fs.writeFileSync(
    snapshotsPath,
    `${JSON.stringify({ version: 2, cases: nextCases }, null, 2)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(demoLogsDir, `${demoId}.json`),
    `${JSON.stringify(logPack, null, 2)}\n`,
    "utf8",
  );
  console.log(`Saved ${demoId} to src/data/demoSnapshots.json and public/demo-logs/${demoId}.json.`);
  console.log("Review the generated files before committing; the importer redacts common secrets but cannot infer every sensitive value.");
}

main().catch((error) => {
  console.error(`Demo import failed: ${error.message}`);
  process.exitCode = 1;
});
