#!/usr/bin/env bun
/**
 * E2E 測試修復 CLI 腳本
 *
 * 使用 Claude Agent SDK + Playwright MCP 診斷和修復 E2E 測試
 *
 * 用法:
 *   bun run scripts/claude/e2e-fix.ts --diagnose       # 診斷所有 E2E 測試
 *   bun run scripts/claude/e2e-fix.ts --run            # 執行 E2E 測試
 *   bun run scripts/claude/e2e-fix.ts --fix <file>     # 修復特定測試
 *
 * 選項:
 *   --diagnose, -d            診斷所有 E2E 測試問題
 *   --run, -r                 執行 E2E 測試
 *   --fix, -f <file>          修復特定測試檔案
 *   --test-name, -t <name>    指定要修復的測試名稱
 *   --auto-apply              自動應用修復（否則只生成建議）
 *   --json                    JSON 格式輸出
 *   --help                    顯示幫助訊息
 *
 * 範例:
 *   bun run scripts/claude/e2e-fix.ts -d
 *   bun run scripts/claude/e2e-fix.ts -r
 *   bun run scripts/claude/e2e-fix.ts -f tests/e2e/auth.spec.ts -t "should login"
 */

import {
  diagnoseE2ETests,
  fixE2ETest,
  runE2ETests,
  formatDiagnosisAsMarkdown,
  formatFixAsMarkdown,
} from "../../packages/services/src/claude-agents/dev/e2e-fixer.js";

// ============================================================
// CLI Argument Parsing
// ============================================================

interface CLIArgs {
  diagnose: boolean;
  run: boolean;
  fix?: string;
  testName?: string;
  autoApply: boolean;
  json: boolean;
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    diagnose: false,
    run: false,
    autoApply: false,
    json: false,
    help: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--diagnose":
      case "-d":
        args.diagnose = true;
        break;
      case "--run":
      case "-r":
        args.run = true;
        break;
      case "--fix":
      case "-f":
        args.fix = argv[++i];
        break;
      case "--test-name":
      case "-t":
        args.testName = argv[++i];
        break;
      case "--auto-apply":
        args.autoApply = true;
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
E2E 測試修復 CLI - 使用 Claude Agent SDK + Playwright MCP

用法:
  bun run scripts/claude/e2e-fix.ts [選項]

選項:
  --diagnose, -d            診斷所有 E2E 測試問題
  --run, -r                 執行 E2E 測試
  --fix, -f <file>          修復特定測試檔案
  --test-name, -t <name>    指定要修復的測試名稱
  --auto-apply              自動應用修復
  --json                    JSON 格式輸出
  --help                    顯示此幫助訊息

範例:
  # 診斷所有 E2E 測試
  bun run scripts/claude/e2e-fix.ts -d

  # 執行 E2E 測試
  bun run scripts/claude/e2e-fix.ts -r

  # 修復特定測試（只生成建議）
  bun run scripts/claude/e2e-fix.ts -f tests/e2e/auth.spec.ts -t "should login successfully"

  # 自動應用修復
  bun run scripts/claude/e2e-fix.ts -f tests/e2e/auth.spec.ts --auto-apply

環境變數:
  ANTHROPIC_API_KEY     - Anthropic API 金鑰（必要）
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
    // 診斷模式
    if (args.diagnose) {
      console.log("🔍 診斷 E2E 測試...");

      const diagnosis = await diagnoseE2ETests();

      if (args.json) {
        console.log(JSON.stringify(diagnosis, null, 2));
      } else {
        console.log(formatDiagnosisAsMarkdown(diagnosis));
      }
      return;
    }

    // 執行模式
    if (args.run) {
      console.log("🧪 執行 E2E 測試...");

      const results = await runE2ETests();

      if (args.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(`\n測試結果: ${results.success ? "✅ 通過" : "❌ 失敗"}`);
        console.log(`總測試數: ${results.results.length}`);

        const failed = results.results.filter((r) => !r.passed);
        if (failed.length > 0) {
          console.log(`\n失敗的測試:`);
          for (const test of failed) {
            console.log(`  - ${test.name}: ${test.error}`);
          }
        }
      }
      return;
    }

    // 修復模式
    if (args.fix) {
      const testFile = args.fix;
      const testName = args.testName ?? "unknown test";

      console.log(`🔧 修復測試: ${testFile}${args.testName ? ` (${testName})` : ""}...`);

      const fix = await fixE2ETest(
        {
          file: testFile,
          name: testName,
          passed: false,
          error: "需要診斷",
        },
        {
          autoApply: args.autoApply,
          diagnosisOnly: !args.autoApply,
        }
      );

      if (args.json) {
        console.log(JSON.stringify(fix, null, 2));
      } else {
        console.log(formatFixAsMarkdown(fix));
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
