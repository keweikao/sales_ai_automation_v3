import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  // 查詢 todo_logs 中與這個 todo 相關的記錄
  console.log("=== Todo Logs (與 customerNumber 202601-123708 相關) ===\n");

  const todoLogResult = await client.query(`
    SELECT
      tl.id,
      tl.action,
      tl.action_via,
      tl.changes,
      tl.note,
      tl.created_at
    FROM todo_logs tl
    JOIN sales_todos st ON tl.todo_id = st.id
    WHERE st.customer_number = '202601-123708'
    ORDER BY tl.created_at DESC
  `);

  for (const log of todoLogResult.rows) {
    console.log(`Action: ${log.action} (via ${log.action_via})`);
    console.log(`Changes: ${JSON.stringify(log.changes, null, 2)}`);
    console.log(`Note: ${log.note || "(null)"}`);
    console.log(`Created: ${log.created_at}`);
    console.log("---");
  }

  // 查詢 conversations 表中是否有相關記錄
  console.log("\n=== Conversations (customerNumber 包含 123708) ===\n");

  const convResult = await client.query(`
    SELECT
      id,
      case_number,
      customer_number,
      title,
      status,
      source,
      created_at
    FROM conversations
    WHERE customer_number LIKE '%123708%'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  if (convResult.rows.length === 0) {
    console.log("找不到相關的 conversation");
  } else {
    for (const conv of convResult.rows) {
      console.log(`Case: ${conv.case_number}`);
      console.log(`Customer: ${conv.customer_number}`);
      console.log(`Title: ${conv.title}`);
      console.log(`Status: ${conv.status}`);
      console.log(`Source: ${conv.source}`);
      console.log(`Created: ${conv.created_at}`);
      console.log("---");
    }
  }

  // 查詢最近的 Slack 上傳記錄
  console.log("\n=== 最近的 Conversations (來自 Slack) ===\n");

  const recentSlackResult = await client.query(`
    SELECT
      case_number,
      customer_number,
      title,
      status,
      created_at
    FROM conversations
    WHERE source = 'slack'
    ORDER BY created_at DESC
    LIMIT 5
  `);

  if (recentSlackResult.rows.length === 0) {
    console.log("找不到來自 Slack 的 conversation");
  } else {
    for (const conv of recentSlackResult.rows) {
      console.log(`${conv.case_number} | ${conv.customer_number} | ${conv.title || "(no title)"} | ${conv.status}`);
    }
  }

  await client.end();
}

main().catch(console.error);
