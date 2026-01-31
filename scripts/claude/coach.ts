#!/usr/bin/env bun
/**
 * 銷售教練 CLI 腳本
 *
 * 使用 Claude Agent SDK 提供互動式銷售教練
 *
 * 用法:
 *   bun run scripts/claude/coach.ts --analyze <id>        # 分析對話
 *   bun run scripts/claude/coach.ts --ask <id> <question> # 提問
 *   bun run scripts/claude/coach.ts --tracks [category]   # 查詢話術
 *   bun run scripts/claude/coach.ts --followup <id> <timing> # 排程跟進
 *
 * 選項:
 *   --analyze, -a <id>        分析對話並提供教練建議
 *   --ask <id> <question>     針對對話提問
 *   --tracks, -t [category]   查詢話術範本
 *   --followup, -f <id> <timing>  排程跟進提醒
 *   --json                    JSON 格式輸出
 *   --help                    顯示幫助訊息
 *
 * 範例:
 *   bun run scripts/claude/coach.ts -a conv-abc123
 *   bun run scripts/claude/coach.ts --ask conv-abc123 "客戶的主要痛點是什麼？"
 *   bun run scripts/claude/coach.ts -t objection_handling
 *   bun run scripts/claude/coach.ts -f opp-123 tomorrow
 */

import {
  analyzeWithCoach,
  askCoach,
  getTalkTracks,
  scheduleFollowUp,
  formatCoachingAsMarkdown,
  type TalkTrackCategory,
  type FollowUpTiming,
} from "../../packages/services/src/claude-agents/sales/index.js";

// ============================================================
// CLI Argument Parsing
// ============================================================

interface CLIArgs {
  analyze?: string;
  ask?: { id: string; question: string };
  tracks?: TalkTrackCategory;
  followup?: { id: string; timing: FollowUpTiming };
  json: boolean;
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    json: false,
    help: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--analyze":
      case "-a":
        args.analyze = argv[++i];
        break;
      case "--ask":
        const askId = argv[++i];
        const question = argv.slice(++i).join(" ");
        args.ask = { id: askId ?? "", question };
        i = argv.length; // 結束迴圈
        break;
      case "--tracks":
      case "-t":
        args.tracks = (argv[++i] ?? "all") as TalkTrackCategory;
        break;
      case "--followup":
      case "-f":
        const followupId = argv[++i];
        const timing = argv[++i] as FollowUpTiming;
        args.followup = { id: followupId ?? "", timing };
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
銷售教練 CLI - 使用 Claude Agent SDK 提供互動式銷售建議

用法:
  bun run scripts/claude/coach.ts [選項]

選項:
  --analyze, -a <id>              分析對話並提供教練建議
  --ask <id> <question>           針對對話提問
  --tracks, -t [category]         查詢話術範本
  --followup, -f <id> <timing>    排程跟進提醒
  --json                          JSON 格式輸出
  --help                          顯示此幫助訊息

話術分類:
  objection_handling  - 異議處理
  discovery          - 需求探索
  closing            - 成交話術
  follow_up          - 跟進話術
  value_prop         - 價值主張
  all                - 所有分類

跟進時間:
  2h        - 2 小時後
  tomorrow  - 明天早上 9 點
  3d        - 3 天後
  1w        - 1 週後

範例:
  # 分析對話
  bun run scripts/claude/coach.ts -a conv-abc123

  # 針對對話提問
  bun run scripts/claude/coach.ts --ask conv-abc123 "客戶的主要痛點是什麼？"

  # 查詢異議處理話術
  bun run scripts/claude/coach.ts -t objection_handling

  # 排程明天跟進
  bun run scripts/claude/coach.ts -f opp-123 tomorrow

環境變數:
  ANTHROPIC_API_KEY        - Anthropic API 金鑰（必要）
  DATABASE_URL             - PostgreSQL 連線字串（分析需要）
  GOOGLE_CLIENT_ID         - Google OAuth Client ID（日曆整合需要）
  GOOGLE_CLIENT_SECRET     - Google OAuth Client Secret
  GOOGLE_REFRESH_TOKEN     - Google OAuth Refresh Token
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
    // 分析模式
    if (args.analyze) {
      console.log(`🎯 分析對話: ${args.analyze}...`);

      const result = await analyzeWithCoach(args.analyze);

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatCoachingAsMarkdown(result));
      }
      return;
    }

    // 提問模式
    if (args.ask) {
      console.log(`🤔 針對對話 ${args.ask.id} 提問...`);

      const result = await askCoach(args.ask.id, args.ask.question);

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("\n## 🎯 Sales Coach 回答\n");
        console.log(`**問題**: ${result.question}\n`);
        console.log(`**回答**: ${result.answer}\n`);
        if (result.relatedDimensions.length > 0) {
          console.log(`**相關維度**: ${result.relatedDimensions.join(", ")}`);
        }
        if (result.suggestedActions && result.suggestedActions.length > 0) {
          console.log("\n**建議行動**:");
          for (const action of result.suggestedActions) {
            console.log(`- [${action.priority}] ${action.description}`);
          }
        }
      }
      return;
    }

    // 話術模式
    if (args.tracks) {
      console.log(`📝 查詢話術範本: ${args.tracks}...`);

      const result = await getTalkTracks(args.tracks);

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\n## 📝 話術範本 - ${result.category}\n`);
        for (const track of result.tracks) {
          console.log(`### ${track.title}\n`);
          console.log(`**情境**: ${track.scenario}\n`);
          console.log(`**話術**:\n> ${track.script}\n`);
          if (track.tips.length > 0) {
            console.log("**提示**:");
            for (const tip of track.tips) {
              console.log(`- ${tip}`);
            }
          }
          console.log();
        }
      }
      return;
    }

    // 跟進模式
    if (args.followup) {
      const validTimings = ["2h", "tomorrow", "3d", "1w"];
      if (!validTimings.includes(args.followup.timing)) {
        console.error(
          `❌ 無效的時間參數: ${args.followup.timing}\n有效選項: ${validTimings.join(", ")}`
        );
        process.exit(1);
      }

      console.log(`📅 排程跟進: ${args.followup.id} (${args.followup.timing})...`);

      const result = await scheduleFollowUp(
        args.followup.id,
        args.followup.timing
      );

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("\n## ✅ 跟進提醒已排程\n");
        console.log(`**標題**: ${result.title}`);
        console.log(`**時間**: ${result.scheduledTime.toLocaleString("zh-TW")}`);
        console.log(`**說明**: ${result.description}`);
        if (result.calendarEventCreated) {
          console.log(`**日曆事件 ID**: ${result.calendarEventId}`);
        }
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
