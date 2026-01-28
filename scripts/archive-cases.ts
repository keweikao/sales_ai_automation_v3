/**
 * 封存測試案件
 *
 * 使用方式：
 *   npx tsx scripts/archive-cases.ts 202601-IC006 202601-IC007 202601-IC008
 *   npx tsx scripts/archive-cases.ts 202601-IC006~202601-IC014  (範圍)
 *   npx tsx scripts/archive-cases.ts --list  (列出所有案件)
 *   npx tsx scripts/archive-cases.ts --list-archived  (列出已封存案件)
 *   npx tsx scripts/archive-cases.ts --unarchive 202601-IC006  (取消封存)
 *   npx tsx scripts/archive-cases.ts --sql 202601-IC006  (只輸出 SQL，不執行)
 */

import * as dotenv from "dotenv";
import pg from "pg";

// 載入環境變數
dotenv.config({ path: "apps/server/.env" });

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📦 案件封存工具

使用方式：
  npx tsx scripts/archive-cases.ts <案件編號...>
  npx tsx scripts/archive-cases.ts 202601-IC006~202601-IC014  (範圍)

選項：
  --list           列出所有未封存案件
  --list-archived  列出已封存案件
  --unarchive      取消封存指定案件
  --sql            只輸出 SQL，不執行（可複製到 Neon Dashboard）

範例：
  npx tsx scripts/archive-cases.ts 202601-IC006 202601-IC007
  npx tsx scripts/archive-cases.ts 202601-IC006~202601-IC014
  npx tsx scripts/archive-cases.ts --sql 202601-IC006~202601-IC014
  npx tsx scripts/archive-cases.ts --unarchive 202601-IC006
`);
    return;
  }

  // 解析選項
  const sqlOnly = args.includes("--sql");
  const listMode = args.includes("--list");
  const listArchivedMode = args.includes("--list-archived");
  const unarchiveMode = args.includes("--unarchive");

  // 過濾掉選項，取得案件編號
  const caseArgs = args.filter((a) => !a.startsWith("--"));

  // 展開範圍（如 202601-IC006~202601-IC014）
  const caseNumbers: string[] = [];
  for (const arg of caseArgs) {
    if (arg.includes("~")) {
      const [start, end] = arg.split("~");
      const startMatch = start.match(/(\d+)-IC(\d+)/);
      const endMatch = end.match(/(\d+)-IC(\d+)/);
      if (startMatch && endMatch) {
        const prefix = startMatch[1];
        const startNum = parseInt(startMatch[2], 10);
        const endNum = parseInt(endMatch[2], 10);
        for (let i = startNum; i <= endNum; i++) {
          caseNumbers.push(`${prefix}-IC${String(i).padStart(3, "0")}`);
        }
      }
    } else {
      caseNumbers.push(arg);
    }
  }

  // SQL 模式：只輸出 SQL
  if (sqlOnly && caseNumbers.length > 0) {
    const action = unarchiveMode ? "completed" : "archived";
    const caseList = caseNumbers.map((c) => `'${c}'`).join(", ");
    console.log(`-- ${unarchiveMode ? "取消封存" : "封存"}案件 SQL`);
    console.log(`UPDATE conversations`);
    console.log(`SET status = '${action}'`);
    console.log(`WHERE case_number IN (${caseList});`);
    return;
  }

  // 連接資料庫
  if (!process.env.DATABASE_URL) {
    console.error("❌ 請設定 DATABASE_URL 環境變數");
    console.log("\n💡 或使用 --sql 選項輸出 SQL 後在 Neon Dashboard 執行");
    return;
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ 資料庫連線成功\n");

    // 列出案件模式
    if (listMode || listArchivedMode) {
      const statusFilter = listArchivedMode ? "= 'archived'" : "!= 'archived'";
      const result = await client.query(`
        SELECT
          c.case_number,
          c.title,
          c.status,
          o.company_name as opportunity_name,
          c.created_at
        FROM conversations c
        LEFT JOIN opportunities o ON c.opportunity_id = o.id
        WHERE c.case_number LIKE '202601-IC%'
          AND c.status ${statusFilter}
        ORDER BY c.case_number
      `);

      const label = listArchivedMode ? "已封存" : "未封存";
      console.log(`📋 ${label}的 202601 案件：\n`);

      if (result.rows.length === 0) {
        console.log(`   沒有${label}的案件`);
      } else {
        for (const row of result.rows) {
          console.log(`${row.case_number} | ${row.title}`);
          console.log(`   商機: ${row.opportunity_name || "無"}`);
          console.log(`   狀態: ${row.status}`);
          console.log("");
        }
        console.log(`共 ${result.rows.length} 筆`);
      }
      return;
    }

    // 封存/取消封存模式
    if (caseNumbers.length === 0) {
      console.log("請提供要處理的案件編號");
      return;
    }

    const newStatus = unarchiveMode ? "completed" : "archived";
    const action = unarchiveMode ? "取消封存" : "封存";

    // 先查詢這些案件是否存在
    const checkResult = await client.query(
      `SELECT case_number, title, status FROM conversations WHERE case_number = ANY($1)`,
      [caseNumbers]
    );

    if (checkResult.rows.length === 0) {
      console.log("❌ 找不到指定的案件");
      return;
    }

    console.log(`🔧 即將${action}以下案件：\n`);
    for (const row of checkResult.rows) {
      console.log(`   ${row.case_number}: ${row.title} (目前狀態: ${row.status})`);
    }

    // 執行更新
    const updateResult = await client.query(
      `UPDATE conversations SET status = $1 WHERE case_number = ANY($2)`,
      [newStatus, caseNumbers]
    );

    console.log(`\n✅ 已${action} ${updateResult.rowCount} 筆案件`);
  } catch (error) {
    console.error("\n❌ 執行失敗:", error);

    if (caseNumbers.length > 0) {
      console.log("\n💡 無法連接資料庫？試試 --sql 選項：");
      console.log(`   npx tsx scripts/archive-cases.ts --sql ${caseNumbers.join(" ")}`);
    }
  } finally {
    await client.end();
  }
}

main();
