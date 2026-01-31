#!/usr/bin/env bun
/**
 * 系統診斷 CLI 腳本
 *
 * 使用 Claude Agent SDK 進行系統診斷
 *
 * 用法:
 *   bun run scripts/claude/diagnose.ts --conversation <id>  # 診斷特定對話
 *   bun run scripts/claude/diagnose.ts --system             # 系統健康檢查
 *   bun run scripts/claude/diagnose.ts --worker <name>      # 分析 Worker 日誌
 *   bun run scripts/claude/diagnose.ts --kv                 # 分析 KV 效能
 *
 * 選項:
 *   --conversation, -c <id>   診斷特定對話
 *   --system, -s              系統健康檢查
 *   --worker, -w <name>       分析 Worker 日誌 (server, queue-worker, slack-bot)
 *   --kv                      分析 KV 快取效能
 *   --hours, -h <number>      時間範圍（小時，預設 24）
 *   --json                    JSON 格式輸出
 *   --auto-repair             啟用自動修復建議
 *   --help                    顯示幫助訊息
 *
 * 範例:
 *   bun run scripts/claude/diagnose.ts -c conv-abc123
 *   bun run scripts/claude/diagnose.ts -s --hours 6
 *   bun run scripts/claude/diagnose.ts -w queue-worker --json
 *   bun run scripts/claude/diagnose.ts --kv --hours 12
 */

import {
  diagnoseConversation,
  diagnoseSystemHealth,
  formatDiagnoseAsMarkdown,
  analyzeWorkerLogs,
  analyzeKVPerformance,
  formatWorkerLogAsMarkdown,
  formatKVAnalysisAsMarkdown,
} from "../../packages/services/src/claude-agents/ops/index.js";

// ============================================================
// CLI Argument Parsing
// ============================================================

interface CLIArgs {
  conversation?: string;
  system: boolean;
  worker?: string;
  kv: boolean;
  hours: number;
  json: boolean;
  autoRepair: boolean;
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    system: false,
    kv: false,
    hours: 24,
    json: false,
    autoRepair: false,
    help: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--conversation":
      case "-c":
        args.conversation = argv[++i];
        break;
      case "--system":
      case "-s":
        args.system = true;
        break;
      case "--worker":
      case "-w":
        args.worker = argv[++i];
        break;
      case "--kv":
        args.kv = true;
        break;
      case "--hours":
      case "-h":
        args.hours = parseInt(argv[++i] ?? "24", 10);
        break;
      case "--json":
        args.json = true;
        break;
      case "--auto-repair":
        args.autoRepair = true;
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
系統診斷 CLI - 使用 Claude Agent SDK 進行智能診斷

用法:
  bun run scripts/claude/diagnose.ts [選項]

選項:
  --conversation, -c <id>   診斷特定對話
  --system, -s              系統健康檢查
  --worker, -w <name>       分析 Worker 日誌
  --kv                      分析 KV 快取效能
  --hours, -h <number>      時間範圍（小時，預設 24）
  --json                    JSON 格式輸出
  --auto-repair             啟用自動修復建議
  --help                    顯示此幫助訊息

Worker 名稱:
  server        - sales-ai-server
  queue-worker  - sales-ai-queue-worker
  slack-bot     - sales-ai-slack-bot

範例:
  # 診斷特定對話
  bun run scripts/claude/diagnose.ts -c conv-abc123

  # 系統健康檢查（最近 6 小時）
  bun run scripts/claude/diagnose.ts -s --hours 6

  # 分析 queue-worker 日誌
  bun run scripts/claude/diagnose.ts -w queue-worker

  # 分析 KV 快取效能
  bun run scripts/claude/diagnose.ts --kv

環境變數:
  ANTHROPIC_API_KEY     - Anthropic API 金鑰（必要）
  DATABASE_URL          - PostgreSQL 連線字串（對話診斷需要）
  CLOUDFLARE_API_TOKEN  - Cloudflare API Token（Worker/KV 分析需要）
  CLOUDFLARE_ACCOUNT_ID - Cloudflare Account ID（Worker/KV 分析需要）
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
    // 對話診斷
    if (args.conversation) {
      console.log(`🔍 診斷對話: ${args.conversation}...`);

      const result = await diagnoseConversation(args.conversation, {
        timeRangeHours: args.hours,
        autoRepair: args.autoRepair,
        includeRelatedConversations: true,
      });

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatDiagnoseAsMarkdown(result, `對話診斷: ${args.conversation}`));
      }
      return;
    }

    // 系統健康檢查
    if (args.system) {
      console.log("🏥 執行系統健康檢查...");

      const result = await diagnoseSystemHealth({
        timeRangeHours: args.hours,
        includeMetrics: true,
      });

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatDiagnoseAsMarkdown(result, "系統健康檢查"));
      }
      return;
    }

    // Worker 日誌分析
    if (args.worker) {
      console.log(`📊 分析 Worker 日誌: ${args.worker}...`);

      const result = await analyzeWorkerLogs(args.worker, {
        timeRangeHours: args.hours,
        includePerformance: true,
      });

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatWorkerLogAsMarkdown(result));
      }
      return;
    }

    // KV 效能分析
    if (args.kv) {
      console.log("📦 分析 KV 快取效能...");

      const result = await analyzeKVPerformance({
        timeRangeHours: args.hours,
        includeHotspots: true,
      });

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatKVAnalysisAsMarkdown(result));
      }
      return;
    }

    // 沒有指定任何動作
    console.log("請指定診斷類型。使用 --help 查看可用選項。");
    process.exit(1);
  } catch (error) {
    console.error(
      "❌ 診斷失敗:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

main();
