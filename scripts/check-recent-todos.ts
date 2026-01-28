import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkRecentTodos() {
  await client.connect();

  console.log("=== 最近建立的 Todos ===\n");

  // 查詢最近的 todos
  const todosResult = await client.query(`
    SELECT
      id,
      title,
      customer_number,
      opportunity_id,
      status,
      source,
      created_at
    FROM sales_todos
    ORDER BY created_at DESC
    LIMIT 5
  `);

  for (const todo of todosResult.rows) {
    console.log(`ID: ${todo.id}`);
    console.log(`Title: ${todo.title}`);
    console.log(`Customer Number: ${todo.customer_number || "(null)"}`);
    console.log(`Opportunity ID: ${todo.opportunity_id || "(null)"}`);
    console.log(`Status: ${todo.status}`);
    console.log(`Source: ${todo.source}`);
    console.log(`Created: ${todo.created_at}`);
    console.log("---");
  }

  // 查詢最近的 todo_logs
  console.log("\n=== 最近的 Todo Logs ===\n");

  const logsResult = await client.query(`
    SELECT
      id,
      todo_id,
      action,
      action_via,
      changes,
      created_at
    FROM todo_logs
    ORDER BY created_at DESC
    LIMIT 5
  `);

  for (const log of logsResult.rows) {
    console.log(`Log ID: ${log.id}`);
    console.log(`Todo ID: ${log.todo_id}`);
    console.log(`Action: ${log.action}`);
    console.log(`Via: ${log.action_via}`);
    console.log(`Changes: ${JSON.stringify(log.changes, null, 2)}`);
    console.log(`Created: ${log.created_at}`);
    console.log("---");
  }

  await client.end();
}

checkRecentTodos().catch(console.error);
