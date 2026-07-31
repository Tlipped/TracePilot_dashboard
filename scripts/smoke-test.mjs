import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const warnings = [];

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function warn(message) {
  warnings.push(message);
}

function includesAll(source, tokens, label) {
  const missing = tokens.filter((token) => !source.includes(token));
  assert(missing.length === 0, `${label} missing: ${missing.join(", ")}`);
}

function checkPackageScripts() {
  const pkg = readJson("package.json");
  includesAll(
    Object.keys(pkg.scripts ?? {}).join("\n"),
    ["build", "lint", "test:smoke", "test:demo-importer", "demo:import"],
    "package scripts",
  );
}

function checkOfflineDemoFallback() {
  const api = readText("src/services/api.ts");
  includesAll(
    api,
    [
      "listDemoTasks",
      "return listDemoTasks()",
      "getDemoTask(taskId)",
      "getDemoTaskLogs(taskId, params)",
      "getDemoFullLog(taskId, logId)",
      "getDemoAgentLogFiles(taskId)",
      "getDemoCaseReview(taskId)",
    ],
    "offline demo fallback",
  );

  const snapshots = readJson("src/data/demoSnapshots.json");
  assert(Array.isArray(snapshots.cases), "demoSnapshots.json must contain a cases array");
  if (snapshots.cases.length === 0) {
    warn("demoSnapshots.json has no cached cases yet. Import demo cases before a submission/demo build.");
    return;
  }

  for (const item of snapshots.cases) {
    assert(item.id, "each demo case needs an id");
    assert(item.name, `demo case ${item.id} needs a name`);
    assert(item.task?.task_id, `demo case ${item.id} needs task.task_id`);
    assert(Array.isArray(item.logs), `demo case ${item.id} needs logs array`);
    assert(item.case_review?.schema_version, `demo case ${item.id} needs a CaseReview snapshot`);
  }
}

function checkDemoImporterSafety() {
  const importer = readText("scripts/import-demo-snapshot.mjs");
  includesAll(
    importer,
    [
      "--dry-run",
      "only terminal tasks can become demo snapshots",
      "[REDACTED PRIVATE KEY]",
      "Review the generated files before committing",
      "/case-review",
    ],
    "demo importer safety",
  );
}

function checkLandingWorkflowContracts() {
  const landing = readText("src/pages/LandingWarRoom.tsx");
  const caseReplayText = "\u5df2\u53d1\u751f\u6848\u4f8b\u590d\u76d8";
  const quickDetectText = "\u5feb\u901f\u653b\u51fb\u68c0\u6d4b";
  includesAll(
    landing,
    [
      'expanded.has("fault_localization")',
      'expanded.add("rag_retrieval")',
      'expanded.has("patch_verification")',
      'expanded.add("patch_generation")',
      "parseTxHashes",
      "detectTransactions",
      "startTransactionDeepAnalysis",
      caseReplayText,
      quickDetectText,
    ],
    "landing workflow contract",
  );

  const taskList = readText("src/pages/TaskList.tsx");
  includesAll(taskList, [caseReplayText, "createTask"], "task list case replay entry");
}

function checkWorkbenchScrollContract() {
  const appCss = readText("src/App.css");
  const indexCss = readText("src/index.css");
  const dashboard = readText("src/pages/Dashboard.tsx");
  const dappContext = readText("src/components/DappContextButton.tsx");

  assert(
    /\.dashboard-layout\s*\{[^}]*overflow-y:\s*auto;[^}]*\}/s.test(appCss),
    "dashboard layout must remain vertically scrollable",
  );
  assert(
    /#root\s*\{[^}]*min-height:\s*100vh;[^}]*\}/s.test(appCss),
    "root must use min-height instead of a fixed viewport height",
  );
  assert(
    /html,\s*body\s*\{[^}]*min-height:\s*100%;[^}]*overflow-y:\s*auto;[^}]*\}/s.test(indexCss),
    "document must preserve natural vertical scrolling",
  );
  assert(
    !dashboard.includes("autoOpenKey=") && !dappContext.includes("autoOpenKey"),
    "DApp context drawer must not auto-open and lock document scrolling",
  );
}

function checkReviewInformationArchitecture() {
  const dashboard = readText("src/pages/Dashboard.tsx");
  const i18n = readText("src/utils/i18n.ts");

  includesAll(
    dashboard,
    [
      'if (mode === "auditor") return "trusted-review";',
      'if (loadingTask || !task) return;',
      'const availableKeys = new Set(["live", "stream", "timeline", "report"]);',
      'if (task?.status === TaskStatus.FAILED) availableKeys.add("recovery");',
      'if (viewMode === "auditor" && hasCaseReviewEntry) availableKeys.add("trusted-review");',
    ],
    "review information architecture",
  );
  assert(
    !dashboard.includes('activeMainTab === "report"'),
    "structured report must not auto-redirect to trusted review",
  );
  assert(
    i18n.includes('auditorMode: "评审"'),
    "Chinese auditor mode must be presented as review mode",
  );
}

function checkWorkbenchNoiseReduction() {
  const dashboard = readText("src/pages/Dashboard.tsx");
  const timeline = readText("src/components/AgentTimeline.tsx");
  const markdown = readText("src/components/MarkdownRenderer.tsx");
  const appCss = readText("src/App.css");

  includesAll(
    dashboard,
    [
      "INSPECTOR_COLLAPSED_STORAGE_KEY",
      "inspectorCollapsed",
      "inspector-collapse-trigger",
      "inspector-rail",
      'title="展开详情侧栏"',
      'title="收起详情侧栏"',
    ],
    "collapsible inspector",
  );
  includesAll(
    appCss,
    [
      ".workbench-grid.inspector-collapsed",
      ".inspector-collapse-trigger",
      ".inspector-rail",
    ],
    "collapsible inspector styles",
  );
  includesAll(
    timeline,
    [
      "isMeaningfulControlEvent",
      'event.type === "CONNECTED"',
      'event.type === "PING"',
      'event.type === "PONG"',
    ],
    "timeline noise filtering",
  );
  assert(!timeline.includes('item.preview || "暂无预览内容。"'), "timeline must not render empty system placeholders");
  includesAll(
    markdown,
    [
      "normalizeMarkdownControlMarkers",
      "inCodeFence",
      "REPLACE|END|PATCH|SEARCH|ORIGINAL|NEW|OLD",
    ],
    "markdown control marker normalization",
  );
}

function checkChineseTextHealth() {
  const files = [
    "src/pages/LandingWarRoom.tsx",
    "src/pages/TaskList.tsx",
    "src/pages/Dashboard.tsx",
    "src/components/LearningGuidePanel.tsx",
  ];
  // Match corruption signatures, not individual CJK characters that can
  // legitimately occur in security terminology.
  const mojibakePattern = /(?:锛|銆|浠诲|鏀诲|缁撴|瀛︿|浜ゆ)/;
  for (const file of files) {
    const source = readText(file);
    if (source.includes("\uFFFD")) {
      warn(`${file} contains replacement characters; check encoding.`);
    }
    if (mojibakePattern.test(source)) {
      warn(`${file} may contain old mojibake fallback text; review visible Chinese copy.`);
    }
  }
}

const checks = [
  checkPackageScripts,
  checkOfflineDemoFallback,
  checkDemoImporterSafety,
  checkLandingWorkflowContracts,
  checkWorkbenchScrollContract,
  checkReviewInformationArchitecture,
  checkWorkbenchNoiseReduction,
  checkChineseTextHealth,
];

for (const check of checks) {
  check();
}

console.log(`Smoke checks passed: ${checks.length}`);
if (warnings.length > 0) {
  console.log("\nWarnings:");
  for (const item of warnings) {
    console.log(`- ${item}`);
  }
}
