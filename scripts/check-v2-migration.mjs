import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../apps/server/.env") });

const sql = neon(process.env.DATABASE_URL);

async function main() {
  console.log("🔍 檢查資料庫中是否有 V2 遷移的資料...\n");
  
  // 1. 查詢總數
  const total = await sql`SELECT COUNT(*) as total FROM opportunities`;
  console.log(`📊 總共有 ${total[0].total} 個 opportunities\n`);
  
  // 2. 查詢不同來源
  const bySources = await sql`
    SELECT source, COUNT(*) as count
    FROM opportunities
    GROUP BY source
    ORDER BY count DESC
  `;
  console.log("📌 按來源分組:");
  console.table(bySources);
  
  // 3. 查詢是否有 customer_number 像 V2 格式的 (例如 202511-IC004)
  console.log("\n🔍 檢查是否有 V2 格式的 customer_number (YYYYMM-ICXXX)...\n");
  const v2Pattern = await sql`
    SELECT id, user_id, customer_number, company_name, source, created_at
    FROM opportunities
    WHERE customer_number ~ '^[0-9]{6}-IC[0-9]+'
    ORDER BY created_at
    LIMIT 20
  `;
  
  if (v2Pattern.length > 0) {
    console.log(`✅ 找到 ${v2Pattern.length} 筆疑似 V2 遷移的資料:`);
    console.table(v2Pattern);
  } else {
    console.log("❌ 沒有找到符合 V2 格式的資料 (customer_number: YYYYMM-ICXXX)\n");
  }
  
  // 4. 檢查 conversations
  console.log("\n📊 檢查 conversations 總數...\n");
  const convTotal = await sql`SELECT COUNT(*) as total FROM conversations`;
  console.log(`總共有 ${convTotal[0].total} 個 conversations\n`);
  
  // 5. 檢查是否有舊的 case_number 格式
  const v2CaseNumbers = await sql`
    SELECT id, opportunity_id, case_number, title, status, created_at
    FROM conversations
    WHERE case_number ~ '^[0-9]{6}-IC[0-9]+'
    ORDER BY created_at
    LIMIT 10
  `;
  
  if (v2CaseNumbers.length > 0) {
    console.log(`✅ 找到 ${v2CaseNumbers.length} 筆疑似 V2 遷移的 conversations:`);
    console.table(v2CaseNumbers);
  } else {
    console.log("❌ 沒有找到符合 V2 格式的 conversations (case_number: YYYYMM-ICXXX)\n");
  }
  
  // 6. 顯示最早和最新的資料
  console.log("\n📅 資料時間範圍分析:\n");
  const timeRange = await sql`
    SELECT 
      MIN(created_at) as earliest,
      MAX(created_at) as latest,
      MAX(created_at) - MIN(created_at) as duration
    FROM opportunities
  `;
  console.table(timeRange);
}

main().catch(console.error);
