import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkAllRecent() {
  await client.connect();

  console.log("=== 過去 1 小時內建立的所有 Todos ===\n");

  const result = await client.query(`
    SELECT id, title, customer_number, opportunity_id, status, source, created_at
    FROM sales_todos
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
  `);

  if (result.rows.length === 0) {
    console.log("(沒有找到任何 Todo)");
  } else {
    for (const todo of result.rows) {
      console.log(`ID: ${todo.id}`);
      console.log(`Title: ${todo.title}`);
      console.log(`Customer Number: ${todo.customer_number || "(null)"}`);
      console.log(`Opportunity ID: ${todo.opportunity_id || "(null)"}`);
      console.log(`Status: ${todo.status}`);
      console.log(`Source: ${todo.source}`);
      console.log(`Created: ${todo.created_at}`);
      console.log("---");
    }
  }

  console.log("\n=== 過去 1 小時內的 Todo Logs ===\n");

  const logsResult = await client.query(`
    SELECT id, todo_id, action, action_via, changes, created_at
    FROM todo_logs
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    ORDER BY created_at DESC
  `);

  if (logsResult.rows.length === 0) {
    console.log("(沒有找到任何 Log)");
  } else {
    for (const log of logsResult.rows) {
      console.log(`Log ID: ${log.id}`);
      console.log(`Todo ID: ${log.todo_id}`);
      console.log(`Action: ${log.action}`);
      console.log(`Via: ${log.action_via}`);
      console.log(`Changes: ${JSON.stringify(log.changes, null, 2)}`);
      console.log(`Created: ${log.created_at}`);
      console.log("---");
    }
  }

  await client.end();
}

checkAllRecent().catch(console.error);
