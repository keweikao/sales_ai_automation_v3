import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 載入環境變數
config({ path: resolve(__dirname, "../apps/server/.env") });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("❌ DATABASE_URL 未設定");
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  console.log("📊 查詢 opportunities 的 user_id 分布...\n");
  
  const oppResult = await sql`
    SELECT 
      user_id,
      COUNT(*) as count,
      MIN(created_at)::date as earliest_date,
      MAX(created_at)::date as latest_date
    FROM opportunities
    GROUP BY user_id
    ORDER BY MIN(created_at)
  `;
  
  console.log("Opportunities 按 user_id 分組:");
  console.table(oppResult);
  
  console.log("\n\n📊 查詢所有用戶資料...\n");
  const userResult = await sql`
    SELECT id, email, name, created_at::date as created_date
    FROM "user"
    ORDER BY created_at
  `;
  
  console.log("用戶列表:");
  console.table(userResult);
  
  console.log("\n\n📊 檢查範例 opportunity 的詳細資料 (按創建時間排序)...\n");
  const sampleOpp = await sql`
    SELECT id, user_id, customer_number, company_name, source, created_at
    FROM opportunities
    ORDER BY created_at
    LIMIT 10
  `;
  
  console.log("前 10 筆 opportunities:");
  console.table(sampleOpp);
}

main().catch(console.error);
