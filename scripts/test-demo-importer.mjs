import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const taskId = "task-1";
const task = {
  task_id: taskId,
  dapp_name: "Importer Smoke",
  status: "completed",
  created_at: "2026-01-01T00:00:00Z",
  final_report: "# Summary\nSmoke test",
};
const caseReview = {
  schema_version: "1.0",
  task_id: taskId,
  dapp_name: task.dapp_name,
  task_status: "completed",
  generated_at: "2026-01-01T00:01:00Z",
  data_source: "legacy_adapter",
  completeness: "minimal",
  language_policy: "en_source_zh_optional",
  attack_stages: [],
  root_causes: [],
  patch_verification: {
    verification_status: "not_run",
    trust_level: "none",
    compile_status: "unknown",
    replay_status: "unknown",
    evidence_refs: [],
    limitations: [],
  },
  evidence: [],
  quality_warnings: [],
  legacy_report_available: true,
};

function respond(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === `/api/tasks/${taskId}`) return respond(response, 200, task);
  if (url.pathname === `/api/tasks/${taskId}/logs`) {
    return respond(response, 200, { events: [], has_more: false, total: 0 });
  }
  if (url.pathname === `/api/tasks/${taskId}/case-review`) return respond(response, 200, caseReview);
  if (url.pathname === `/api/tasks/${taskId}/agent-log-files`) {
    return respond(response, 200, { log_dir: null, files: [] });
  }
  return respond(response, 404, { detail: "Not available in importer smoke server" });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const baseUrl = `http://127.0.0.1:${address.port}`;
const importer = path.join(process.cwd(), "scripts", "import-demo-snapshot.mjs");

const result = await new Promise((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [importer, "--base-url", baseUrl, "--task-id", taskId, "--dry-run"],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
  );
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", reject);
  child.on("close", (code) => resolve({ code, stdout, stderr }));
});

server.close();
assert.equal(result.code, 0, result.stderr);
assert.match(result.stdout, /Dry run complete/);
assert.match(result.stdout, /0 logs, 0 evidence items/);
console.log("Demo importer smoke check passed.");
