#!/usr/bin/env bun
/**
 * 銷售記憶管理 CLI 腳本
 *
 * 使用 Claude Agent SDK + Memory MCP 管理客戶記憶
 *
 * 用法:
 *   bun run scripts/claude/memory.ts --save <customer_id>     # 儲存記憶
 *   bun run scripts/claude/memory.ts --get <customer_id>      # 取得客戶歷史
 *   bun run scripts/claude/memory.ts --insights <customer_id> # 生成洞察
 *   bun run scripts/claude/memory.ts --extract <conv_id>      # 從對話提取記憶
 *
 * 選項:
 *   --save, -s <customer_id>       儲存客戶記憶
 *   --get, -g <customer_id>        取得客戶歷史記憶
 *   --insights, -i <customer_id>   生成個人化洞察
 *   --extract, -e <conversation_id> 從對話提取記憶
 *   --type, -t <type>              記憶類型
 *   --content, -c <content>        記憶內容
 *   --days <number>                時間範圍（天）
 *   --json                         JSON 格式輸出
 *   --help                         顯示幫助訊息
 *
 * 範例:
 *   bun run scripts/claude/memory.ts -s cust-123 -t pain_point -c "客戶對價格敏感"
 *   bun run scripts/claude/memory.ts -g cust-123 --days 30
 *   bun run scripts/claude/memory.ts -i cust-123
 *   bun run scripts/claude/memory.ts -e conv-456
 */

import {
  saveCustomerMemory,
  getCustomerHistory,
  generatePersonalizedInsights,
  extractMemoriesFromConversation,
  formatCustomerProfileAsMarkdown,
  formatInsightsAsMarkdown,
  type MemoryType,
} from "../../packages/services/src/claude-agents/sales/memory-manager.js";

// ============================================================
// CLI Argument Parsing
// ============================================================

interface CLIArgs {
  save?: string;
  get?: string;
  insights?: string;
  extract?: string;
  type?: MemoryType;
  content?: string;
  days: number;
  json: boolean;
  help: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    days: 90,
    json: false,
    help: false,
  };

  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--save":
      case "-s":
        args.save = argv[++i];
        break;
      case "--get":
      case "-g":
        args.get = argv[++i];
        break;
      case "--insights":
      case "-i":
        args.insights = argv[++i];
        break;
      case "--extract":
      case "-e":
        args.extract = argv[++i];
        break;
      case "--type":
      case "-t":
        args.type = argv[++i] as MemoryType;
        break;
      case "--content":
      case "-c":
        args.content = argv[++i];
        break;
      case "--days":
        args.days = parseInt(argv[++i] ?? "90", 10);
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
銷售記憶管理 CLI - 使用 Claude Agent SDK + Memory MCP

用法:
  bun run scripts/claude/memory.ts [選項]

選項:
  --save, -s <customer_id>         儲存客戶記憶
  --get, -g <customer_id>          取得客戶歷史記憶
  --insights, -i <customer_id>     生成個人化洞察
  --extract, -e <conversation_id>  從對話提取記憶
  --type, -t <type>                記憶類型
  --content, -c <content>          記憶內容
  --days <number>                  時間範圍（天，預設 90）
  --json                           JSON 格式輸出
  --help                           顯示此幫助訊息

記憶類型:
  pain_point          - 客戶痛點
  preference          - 客戶偏好
  decision_maker      - 決策者資訊
  budget_info         - 預算資訊
  timeline            - 時程資訊
  competitor_mention  - 競品提及
  objection           - 客戶異議
  success_criteria    - 成功標準
  relationship_note   - 關係備註
  follow_up           - 跟進事項
  other               - 其他

範例:
  # 儲存客戶記憶
  bun run scripts/claude/memory.ts -s cust-123 -t pain_point -c "客戶對現有系統整合困難"

  # 取得客戶歷史（最近 30 天）
  bun run scripts/claude/memory.ts -g cust-123 --days 30

  # 生成個人化洞察
  bun run scripts/claude/memory.ts -i cust-123

  # 從對話提取記憶
  bun run scripts/claude/memory.ts -e conv-456

環境變數:
  ANTHROPIC_API_KEY     - Anthropic API 金鑰（必要）
  DATABASE_URL          - PostgreSQL 連線字串（對話查詢需要）
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
    // 儲存記憶
    if (args.save) {
      if (!args.type || !args.content) {
        console.error("❌ 錯誤: 儲存記憶需要 --type 和 --content");
        process.exit(1);
      }

      console.log(`💾 儲存客戶記憶: ${args.save}...`);

      const result = await saveCustomerMemory(args.save, {
        type: args.type,
        content: args.content,
      });

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        if (result.success && result.memory) {
          console.log("\n✅ 記憶已儲存\n");
          console.log(`**ID**: ${result.memory.id}`);
          console.log(`**類型**: ${result.memory.type}`);
          console.log(`**內容**: ${result.memory.content}`);
          console.log(`**信心程度**: ${result.memory.confidence}`);
          console.log(`**建立時間**: ${result.memory.createdAt}`);
        } else {
          console.log("❌ 儲存失敗");
        }
      }
      return;
    }

    // 取得歷史
    if (args.get) {
      console.log(`📖 取得客戶歷史: ${args.get}...`);

      const result = await getCustomerHistory(args.get, {
        daysBack: args.days,
      });

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatCustomerProfileAsMarkdown(result));
      }
      return;
    }

    // 生成洞察
    if (args.insights) {
      console.log(`💡 生成個人化洞察: ${args.insights}...`);

      const result = await generatePersonalizedInsights(args.insights);

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatInsightsAsMarkdown(result));
      }
      return;
    }

    // 從對話提取
    if (args.extract) {
      console.log(`🔍 從對話提取記憶: ${args.extract}...`);

      const result = await extractMemoriesFromConversation(args.extract);

      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("\n## 🧠 提取的記憶\n");
        console.log(`**對話 ID**: ${result.conversationId}`);
        if (result.suggestedCustomerId) {
          console.log(`**建議客戶 ID**: ${result.suggestedCustomerId}`);
        }
        console.log(`\n**提取了 ${result.extractedMemories.length} 條記憶**:\n`);

        for (const mem of result.extractedMemories) {
          console.log(`### ${mem.type}`);
          console.log(`- **內容**: ${mem.content}`);
          console.log(`- **信心程度**: ${mem.confidence ?? 0.8}`);
          if (mem.quote) {
            console.log(`- **原文**: "${mem.quote}"`);
          }
          if (mem.tags && mem.tags.length > 0) {
            console.log(`- **標籤**: ${mem.tags.join(", ")}`);
          }
          console.log();
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
