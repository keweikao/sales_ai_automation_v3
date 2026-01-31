#!/usr/bin/env bun
/**
 * 系統監控 CLI 腳本
 *
 * 使用 Claude Agent SDK + Datadog MCP 進行系統監控
 *
 * 用法:
 *   bun run scripts/claude/monitor.ts --apm [service]       # APM 分析
 *   bun run scripts/claude/monitor.ts --anomalies           # 異常檢測
 *   bun run scripts/claude/monitor.ts --alert <type> <svc>  # 生成告警配置
 *
 * 選項:
 *   --apm, -a [service]       分析 APM 指標
 *   --anomalies, -d           檢測系統異常
 *   --alert <type> <service>  生成告警配置
 *   --hours, -h <number>      時間範圍（小時，預設 24）
 *   --sensitivity <level>     異常檢測敏感度 (low/medium/high)
 *   --traces                  包含追蹤分析
 *   --resources               包含資源指標
 *   --json                    JSON 格式輸出
 *   --help                    顯示幫助訊息
 *
 * 範例:
 *   bun run scripts/claude/monitor.ts -a server --hours 6
 *   bun run scripts/claude/monitor.ts -d --sensitivity high
 *   bun run scripts/claude/monitor.ts --alert latency server
 */

import {
  analyzeAPM,
  detectAnomalies,
  generateAlertConfig,
  formatAPMAsMarkdown,
  formatAnomaliesAsMarkdown,
} from "../../packages/services/src/claude-agents/ops/datadog.js";

// ============================================================
// CLI Argument Parsing
// ============================================================

interface CLIArgs {
  apm?: string | true;
  anomalies: boolean;
  alert?: { type: string; service: string };
  hours: number;
  sensitivity: "low" | "medium" | "high";
  traces: boolean;
  resources: boolean;
  json: boolean;
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    anomalies: false,
    hours: 24,
    sensitivity: "medium",
    traces: false,
    resources: false,
    json: false,
    help: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--apm":
      case "-a":
        const nextArg = argv[i + 1];
        if (nextArg && !nextArg.startsWith("-")) {
          args.apm = nextArg;
          i++;
        } else {
          args.apm = true;
        }
        break;
      case "--anomalies":
      case "-d":
        args.anomalies = true;
        break;
      case "--alert":
        const alertType = argv[++i];
        const alertService = argv[++i];
        args.alert = { type: alertType ?? "", service: alertService ?? "" };
        break;
      case "--hours":
      case "-h":
        args.hours = parseInt(argv[++i] ?? "24", 10);
        break;
      case "--sensitivity":
        args.sensitivity = argv[++i] as "low" | "medium" | "high";
        break;
      case "--traces":
        args.traces = true;
        break;
      case "--resources":
        args.resources = true;
        break;
      case "--json":
        args.json = true;
        break;
      case "--help":
        args.help = true;
        break;
    }
  }

  return args;
}

function printHelp(): void {
  console.log(`
系統監控 CLI - 使用 Claude Agent SDK + Datadog MCP

用法:
  bun run scripts/claude/monitor.ts [選項]

選項:
  --apm, -a [service]         分析 APM 指標（可選指定服務）
  --anomalies, -d             檢測系統異常
  --alert <type> <service>    生成告警配置
  --hours, -h <number>        時間範圍（小時，預設 24）
  --sensitivity <level>       異常檢測敏感度 (low/medium/high)
  --traces                    包含追蹤分析
  --resources                 包含資源指標
  --json                      JSON 格式輸出
  --help                      顯示此幫助訊息

服務名稱:
  server        - sales-ai-server
  queue-worker  - sales-ai-queue-worker
  slack-bot     - sales-ai-slack-bot
  web           - sales-ai-web

告警類型:
  latency       - 延遲告警
  error_rate    - 錯誤率告警
  throughput    - 吞吐量告警
  cpu           - CPU 使用率告警
  memory        - 記憶體使用率告警

範例:
  # 分析所有服務的 APM 指標
  bun run scripts/claude/monitor.ts -a

  # 分析特定服務（最近 6 小時，含追蹤）
  bun run scripts/claude/monitor.ts -a server --hours 6 --traces

  # 高敏感度異常檢測
  bun run scripts/claude/monitor.ts -d --sensitivity high

  # 生成延遲告警配置
  bun run scripts/claude/monitor.ts --alert latency server

環境變數:
  ANTHROPIC_API_KEY  - Anthropic API 金鑰（必要）
  DD_API_KEY         - Datadog API Key（必要）
  DD_APP_KEY         - Datadog Application Key（必要）
`);
}

// ============================================================
// Main
// ============================================================

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // 驗證環境變數
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ 錯誤: 請設定 ANTHROPIC_API_KEY 環境變數");
    process.exit(1);
  }

  try {
    // APM 分析
    if (args.apm !== undefined) {
      const service = typeof args.apm === "string" ? args.apm : undefined;
      console.log(`📊 分析 APM 指標${service ? `: ${service}` : " (所有服務)"}...`);

      const result = await analyzeAPM({
        service,
        timeRangeHours: args.hours,
        includeTraces: args.traces,
        includeResources: args.resources,
      });

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatAPMAsMarkdown(result));
      }
      return;
    }

    // 異常檢測
    if (args.anomalies) {
      console.log(`🔍 檢測系統異常 (敏感度: ${args.sensitivity})...`);

      const result = await detectAnomalies({
        timeRangeHours: args.hours,
        sensitivity: args.sensitivity,
      });

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatAnomaliesAsMarkdown(result));
      }
      return;
    }

    // 告警配置
    if (args.alert) {
      if (!args.alert.type || !args.alert.service) {
        console.error("❌ 錯誤: 請指定告警類型和服務");
        console.error("用法: --alert <type> <service>");
        process.exit(1);
      }

      console.log(`⚠️ 生成告警配置: ${args.alert.type} for ${args.alert.service}...`);

      const result = await generateAlertConfig(
        args.alert.type,
        args.alert.service
      );

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("\n## ⚠️ 告警配置\n");
        console.log(`**名稱**: ${result.name}`);
        console.log(`**類型**: ${result.type}`);
        console.log(`**查詢**: \`${result.query}\``);
        console.log(`**Warning 閾值**: ${result.thresholds.warning ?? "N/A"}`);
        console.log(`**Critical 閾值**: ${result.thresholds.critical}`);
        console.log(`**通知管道**: ${result.notificationChannels.join(", ")}`);
        console.log(`\n**描述**: ${result.description}`);
      }
      return;
    }

    // 沒有指定任何動作
    console.log("請指定操作類型。使用 --help 查看可用選項。");
    process.exit(1);
  } catch (error) {
    console.error(
      "❌ 操作失敗:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

main();
