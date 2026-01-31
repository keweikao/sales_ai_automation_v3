#!/usr/bin/env bun
/**
 * PR 審查 CLI 腳本
 *
 * 使用 Claude Agent SDK 自動審查 Pull Request
 *
 * @usage
 * ```bash
 * # 審查 PR
 * bun run scripts/claude/pr-review.ts --pr 123
 *
 * # 指定審查重點
 * bun run scripts/claude/pr-review.ts --pr 123 --focus security,types
 *
 * # 輸出 JSON 格式
 * bun run scripts/claude/pr-review.ts --pr 123 --json
 *
 * # 顯示幫助
 * bun run scripts/claude/pr-review.ts --help
 * ```
 */

import {
  formatReviewAsMarkdown,
  reviewPullRequest,
} from "../../packages/services/src/claude-agents/dev/pr-reviewer.js";
import type { PRReviewFocusArea } from "../../packages/claude-sdk/src/types.js";

// ============================================================
// CLI 參數解析
// ============================================================

interface CLIArgs {
  prNumber?: number;
  focusAreas?: PRReviewFocusArea[];
  jsonOutput?: boolean;
  help?: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--pr":
      case "-p":
        result.prNumber = parseInt(args[++i], 10);
        break;

      case "--focus":
      case "-f":
        result.focusAreas = args[++i].split(",") as PRReviewFocusArea[];
        break;

      case "--json":
      case "-j":
        result.jsonOutput = true;
        break;

      case "--help":
      case "-h":
        result.help = true;
        break;

      default:
        // 支援直接傳入 PR 編號
        if (!isNaN(parseInt(arg, 10))) {
          result.prNumber = parseInt(arg, 10);
        }
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
📋 PR 審查 CLI

使用 Claude Agent SDK 自動審查 Pull Request

用法:
  bun run scripts/claude/pr-review.ts [選項] [PR編號]

選項:
  --pr, -p <number>     PR 編號 (必填)
  --focus, -f <areas>   審查重點，逗號分隔 (可選)
                        可用值: security, types, tests, meddic, performance
  --json, -j            輸出 JSON 格式
  --help, -h            顯示此幫助訊息

範例:
  # 審查 PR #123
  bun run scripts/claude/pr-review.ts --pr 123

  # 只審查安全性和型別
  bun run scripts/claude/pr-review.ts --pr 123 --focus security,types

  # 輸出 JSON 格式 (適用於 CI)
  bun run scripts/claude/pr-review.ts --pr 123 --json

環境變數:
  ANTHROPIC_API_KEY     Claude API 金鑰 (必填)
  GITHUB_TOKEN          GitHub Token (必填，用於讀取 PR)
`);
}

// ============================================================
// 主程式
// ============================================================

async function main(): Promise<void> {
  const args = parseArgs();

  // 顯示幫助
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // 驗證參數
  if (!args.prNumber) {
    console.error("❌ 錯誤: 請提供 PR 編號");
    console.error("使用 --help 查看用法");
    process.exit(1);
  }

  // 驗證環境變數
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ 錯誤: 請設定 ANTHROPIC_API_KEY 環境變數");
    process.exit(1);
  }

  if (!process.env.GITHUB_TOKEN) {
    console.error("❌ 錯誤: 請設定 GITHUB_TOKEN 環境變數");
    process.exit(1);
  }

  // 執行審查
  if (!args.jsonOutput) {
    console.log(`🔍 開始審查 PR #${args.prNumber}...`);
    console.log("");
  }

  try {
    const startTime = Date.now();

    const result = await reviewPullRequest(args.prNumber, {
      focusAreas: args.focusAreas,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // 輸出結果
    if (args.jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatReviewAsMarkdown(result));
      console.log(`\n⏱️  審查耗時: ${duration}s`);
    }

    // 設定 exit code
    process.exit(result.approved ? 0 : 1);
  } catch (error) {
    if (args.jsonOutput) {
      console.log(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    } else {
      console.error("❌ 審查失敗:", error);
    }
    process.exit(1);
  }
}

main();
