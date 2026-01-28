import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkConversationTodo() {
  await client.connect();

  const customerNumber = "202609-000001";

  console.log(`=== 查詢客戶編號: ${customerNumber} ===\n`);

  // 查詢 conversations
  const convResult = await client.query(`
    SELECT
      id,
      case_number,
      customer_number,
      status,
      created_at
    FROM conversations
    WHERE customer_number = $1
    ORDER BY created_at DESC
    LIMIT 3
  `, [customerNumber]);

  console.log("Conversations:");
  for (const conv of convResult.rows) {
    console.log(`  ID: ${conv.id}`);
    console.log(`  Case Number: ${conv.case_number}`);
    console.log(`  Status: ${conv.status}`);
    console.log(`  Created: ${conv.created_at}`);
    console.log("  ---");
  }

  // 查詢相關的 todos
  console.log("\nTodos with this customer_number:");
  const todoResult = await client.query(`
    SELECT
      id,
      title,
      customer_number,
      status,
      source,
      created_at
    FROM sales_todos
    WHERE customer_number = $1
    ORDER BY created_at DESC
  `, [customerNumber]);

  if (todoResult.rows.length === 0) {
    console.log("  (沒有找到任何 Todo)");
  } else {
    for (const todo of todoResult.rows) {
      console.log(`  ID: ${todo.id}`);
      console.log(`  Title: ${todo.title}`);
      console.log(`  Status: ${todo.status}`);
      console.log(`  Source: ${todo.source}`);
      console.log(`  Created: ${todo.created_at}`);
      console.log("  ---");
    }
  }

  // 查詢今天所有的 todos
  console.log("\n=== 今天所有建立的 Todos ===");
  const todayTodos = await client.query(`
    SELECT
      id,
      title,
      customer_number,
      opportunity_id,
      source,
      created_at
    FROM sales_todos
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
  `);

  for (const todo of todayTodos.rows) {
    console.log(`ID: ${todo.id}`);
    console.log(`Title: ${todo.title}`);
    console.log(`Customer Number: ${todo.customer_number || "(null)"}`);
    console.log(`Opportunity ID: ${todo.opportunity_id || "(null)"}`);
    console.log(`Source: ${todo.source}`);
    console.log(`Created: ${todo.created_at}`);
    console.log("---");
  }

  await client.end();
}

checkConversationTodo().catch(console.error);
