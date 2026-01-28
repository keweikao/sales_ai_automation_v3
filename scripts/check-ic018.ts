import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkIC018() {
  await client.connect();

  console.log("=== 案件 202601-IC018 ===\n");

  // 查詢 conversation
  const convResult = await client.query(`
    SELECT id, opportunity_id, case_number, status, created_at
    FROM conversations
    WHERE case_number = '202601-IC018'
    LIMIT 1
  `);

  if (convResult.rows.length > 0) {
    const conv = convResult.rows[0];
    console.log("Conversation:");
    console.log(`  ID: ${conv.id}`);
    console.log(`  Opportunity ID: ${conv.opportunity_id}`);
    console.log(`  Status: ${conv.status}`);
    console.log(`  Created: ${conv.created_at}`);

    // 查詢 opportunity 取得 customerNumber
    const oppResult = await client.query(`
      SELECT id, customer_number, company_name
      FROM opportunities
      WHERE id = $1
    `, [conv.opportunity_id]);

    if (oppResult.rows.length > 0) {
      const opp = oppResult.rows[0];
      console.log(`\nOpportunity:`);
      console.log(`  Customer Number: ${opp.customer_number}`);
      console.log(`  Company: ${opp.company_name}`);

      // 查詢這個 customerNumber 的 todos
      console.log(`\n=== Todos with customer_number = ${opp.customer_number} ===\n`);
      const todoResult = await client.query(`
        SELECT id, title, customer_number, status, source, created_at
        FROM sales_todos
        WHERE customer_number = $1
        ORDER BY created_at DESC
      `, [opp.customer_number]);

      if (todoResult.rows.length === 0) {
        console.log("(沒有找到 Todo)");
      } else {
        for (const todo of todoResult.rows) {
          console.log(`ID: ${todo.id}`);
          console.log(`Title: ${todo.title}`);
          console.log(`Customer Number: ${todo.customer_number}`);
          console.log(`Status: ${todo.status}`);
          console.log(`Source: ${todo.source}`);
          console.log(`Created: ${todo.created_at}`);
          console.log("---");
        }
      }
    }
  } else {
    console.log("沒有找到案件 202601-IC018");
  }

  // 也查詢最近的 todos
  console.log("\n=== 最近 5 筆 Todos ===\n");
  const recentTodos = await client.query(`
    SELECT id, title, customer_number, status, source, created_at
    FROM sales_todos
    ORDER BY created_at DESC
    LIMIT 5
  `);

  for (const todo of recentTodos.rows) {
    console.log(`Title: ${todo.title}`);
    console.log(`Customer Number: ${todo.customer_number || "(null)"}`);
    console.log(`Source: ${todo.source}`);
    console.log(`Created: ${todo.created_at}`);
    console.log("---");
  }

  await client.end();
}

checkIC018().catch(console.error);
