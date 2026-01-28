/**
 * Seed Script: 將 competitor-kb.json 匯入資料庫
 *
 * 執行方式: bun run scripts/seed-competitors.ts
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { competitorInfo } from "../packages/db/src/schema/competitor-info.js";

interface CompetitorKB {
  knowledge_base_version: string;
  last_updated: string;
  categories: Array<{
    category: string;
    our_product: string;
    competitors: Array<{
      brand: string;
      advantages: string[];
      disadvantages: string[];
      features_comparison: string;
      pricing: string;
      differentiation: string;
      rebuttal_scripts: string[];
    }>;
  }>;
}

async function main() {
  console.log("🚀 開始匯入競品資料...\n");

  // 1. 讀取 .env 取得 DATABASE_URL
  const envPath = join(process.cwd(), "apps/server/.env");
  const envContent = readFileSync(envPath, "utf-8");
  const databaseUrlMatch = envContent.match(/DATABASE_URL=(.+)/);

  if (!databaseUrlMatch) {
    throw new Error("找不到 DATABASE_URL");
  }

  const databaseUrl = databaseUrlMatch[1].trim();
  console.log("📡 連接資料庫...\n");

  // 建立資料庫連線
  const sql = neon(databaseUrl);
  const db = drizzle(sql);

  // 2. 讀取 competitor-kb.json
  const kbPath = join(process.cwd(), "competitor-kb.json");
  console.log(`📖 讀取檔案: ${kbPath}`);

  const kbContent = readFileSync(kbPath, "utf-8");
  const kb: CompetitorKB = JSON.parse(kbContent);

  console.log(
    `✅ 成功讀取知識庫版本: ${kb.knowledge_base_version} (更新日期: ${kb.last_updated})\n`
  );

  // 2. 轉換並插入資料
  let successCount = 0;
  let errorCount = 0;

  for (const category of kb.categories) {
    console.log(`\n📂 處理類別: ${category.category} (${category.our_product})`);

    for (const competitor of category.competitors) {
      try {
        // 從品牌名稱中提取簡短名稱（例如：「肚肚 Dudoo」→「肚肚」）
        const competitorName = competitor.brand.split(" ")[0];

        // 從 differentiation 中提取我方優勢
        const ourAdvantages = extractOurAdvantages(
          competitor.differentiation,
          competitor.features_comparison
        );

        // 插入資料（使用 ON CONFLICT DO UPDATE 處理重複）
        await db
          .insert(competitorInfo)
          .values({
            id: randomUUID(),
            competitorName: competitorName,
            strengths: competitor.advantages,
            weaknesses: competitor.disadvantages,
            ourAdvantages: ourAdvantages,
            counterTalkTracks: competitor.rebuttal_scripts,
            switchingCases: [],
          })
          .onConflictDoUpdate({
            target: competitorInfo.competitorName,
            set: {
              strengths: competitor.advantages,
              weaknesses: competitor.disadvantages,
              ourAdvantages: ourAdvantages,
              counterTalkTracks: competitor.rebuttal_scripts,
              updatedAt: new Date(),
            },
          });

        console.log(`  ✅ ${competitorName} - 匯入成功`);
        successCount++;
      } catch (error) {
        console.error(
          `  ❌ ${competitor.brand} - 匯入失敗:`,
          error instanceof Error ? error.message : error
        );
        errorCount++;
      }
    }
  }

  // 3. 顯示結果
  console.log("\n" + "=".repeat(50));
  console.log("📊 匯入結果統計");
  console.log("=".repeat(50));
  console.log(`✅ 成功: ${successCount} 個競品`);
  console.log(`❌ 失敗: ${errorCount} 個競品`);
  console.log(`📦 總計: ${successCount + errorCount} 個競品\n`);

  // 4. 驗證資料
  console.log("🔍 驗證資料庫...");
  const allCompetitors = await db.select().from(competitorInfo);
  console.log(`✅ 資料庫中共有 ${allCompetitors.length} 個競品記錄\n`);

  // 列出所有競品名稱
  console.log("📋 競品列表:");
  allCompetitors.forEach((comp, index) => {
    console.log(`  ${index + 1}. ${comp.competitorName}`);
  });

  console.log("\n✨ 匯入完成！");
}

/**
 * 從 differentiation 和 features_comparison 中提取我方優勢
 */
function extractOurAdvantages(
  differentiation: string,
  featuresComparison: string
): string[] {
  const advantages: string[] = [];

  // 從 differentiation 中提取關鍵優勢
  // 常見模式：「iCHEF 的 XXX」、「我們的 XXX」
  const patterns = [
    /iCHEF[^。]+?(?=。|；|，|$)/g,
    /QLiEER[^。]+?(?=。|；|，|$)/g,
    /我方[^。]+?(?=。|；|，|$)/g,
    /我們[^。]+?(?=。|；|，|$)/g,
  ];

  const combinedText = `${differentiation} ${featuresComparison}`;

  for (const pattern of patterns) {
    const matches = combinedText.match(pattern);
    if (matches) {
      advantages.push(...matches.map((m) => m.trim()).filter((m) => m.length > 10));
    }
  }

  // 去重並限制數量
  const uniqueAdvantages = Array.from(new Set(advantages)).slice(0, 8);

  // 如果自動提取不足 3 項，加入預設優勢
  if (uniqueAdvantages.length < 3) {
    const defaultAdvantages = [
      "10,000+ 餐廳實際驗證，系統穩定度業界第一",
      "iCHEF 餐廳幫社群有 8,000+ 位餐廳老闆交流經營心得",
      "價格透明，全功能包含，沒有隱藏成本",
    ];
    uniqueAdvantages.push(...defaultAdvantages.slice(0, 3 - uniqueAdvantages.length));
  }

  return uniqueAdvantages.length > 0 ? uniqueAdvantages : ["專注台灣市場，深入了解在地需求"];
}

// 執行主程式
main().catch((error) => {
  console.error("❌ 執行失敗:", error);
  process.exit(1);
});
