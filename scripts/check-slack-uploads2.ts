import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  // 查詢最近的 conversations
  console.log("=== 最近的 Conversations ===\n");
  const convResult = await client.query(`
    SELECT
      case_number,
      title,
      status,
      store_name,
      slack_username,
      created_at
    FROM conversations
    ORDER BY created_at DESC
    LIMIT 10
  `);

  for (const conv of convResult.rows) {
    console.log(`${conv.case_number || "(no case)"} | ${conv.store_name || "(no store)"} | ${conv.status} | ${conv.slack_username || "(no user)"} | ${conv.created_at}`);
  }

  // 搜尋 case_number 或 store_name 包含 123708
  console.log("\n=== 搜尋 123708 ===\n");
  const searchResult = await client.query(`
    SELECT case_number, store_name, title, status, created_at
    FROM conversations
    WHERE case_number LIKE '%123708%' OR store_name LIKE '%123708%'
  `);

  if (searchResult.rows.length === 0) {
    console.log("找不到包含 123708 的 conversation");
  } else {
    for (const conv of searchResult.rows) {
      console.log(`${conv.case_number} | ${conv.store_name} | ${conv.status}`);
    }
  }

  // 查詢今天的上傳記錄
  console.log("\n=== 今天的上傳記錄 ===\n");
  const todayResult = await client.query(`
    SELECT case_number, store_name, title, status, slack_username, created_at
    FROM conversations
    WHERE created_at >= CURRENT_DATE
    ORDER BY created_at DESC
  `);

  if (todayResult.rows.length === 0) {
    console.log("今天沒有上傳記錄");
  } else {
    console.log(`共 ${todayResult.rows.length} 筆`);
    for (const conv of todayResult.rows) {
      console.log(`${conv.case_number} | ${conv.store_name || "(no store)"} | ${conv.status} | ${conv.slack_username}`);
    }
  }

  await client.end();
}

main().catch(console.error);
