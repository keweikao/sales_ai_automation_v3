import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  // 先查看 conversations 表結構
  console.log("=== Conversations 表結構 ===\n");
  const schemaResult = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'conversations'
    ORDER BY ordinal_position
  `);
  for (const col of schemaResult.rows) {
    console.log(`${col.column_name}: ${col.data_type}`);
  }

  // 查詢最近的 conversations
  console.log("\n=== 最近的 Conversations ===\n");
  const convResult = await client.query(`
    SELECT
      id,
      case_number,
      title,
      status,
      source,
      created_at
    FROM conversations
    ORDER BY created_at DESC
    LIMIT 10
  `);

  for (const conv of convResult.rows) {
    console.log(`${conv.case_number || "(no case)"} | ${conv.source} | ${conv.status} | ${conv.created_at}`);
  }

  // 查詢是否有 case_number 包含 123708 的
  console.log("\n=== 搜尋 case_number 包含 123708 ===\n");
  const searchResult = await client.query(`
    SELECT case_number, title, status, source, created_at
    FROM conversations
    WHERE case_number LIKE '%123708%'
  `);

  if (searchResult.rows.length === 0) {
    console.log("找不到");
  } else {
    for (const conv of searchResult.rows) {
      console.log(`${conv.case_number} | ${conv.title} | ${conv.status}`);
    }
  }

  await client.end();
}

main().catch(console.error);
