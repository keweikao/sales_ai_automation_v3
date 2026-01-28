import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

const customerNumber = process.argv[2] || "202609-000010";

async function checkCustomer() {
  await client.connect();

  console.log(`=== 查詢客戶編號: ${customerNumber} ===\n`);

  // 查詢 opportunity
  const oppResult = await client.query(`
    SELECT id, customer_number, company_name, status, created_at
    FROM opportunities
    WHERE customer_number = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [customerNumber]);

  if (oppResult.rows.length > 0) {
    const opp = oppResult.rows[0];
    console.log("Opportunity:");
    console.log(`  ID: ${opp.id}`);
    console.log(`  Customer Number: ${opp.customer_number}`);
    console.log(`  Company: ${opp.company_name}`);
    console.log(`  Status: ${opp.status}`);
    console.log(`  Created: ${opp.created_at}`);

    // 查詢相關 conversations
    console.log("\nConversations:");
    const convResult = await client.query(`
      SELECT id, case_number, status, created_at
      FROM conversations
      WHERE opportunity_id = $1
      ORDER BY created_at DESC
    `, [opp.id]);

    for (const conv of convResult.rows) {
      console.log(`  Case: ${conv.case_number}, Status: ${conv.status}, Created: ${conv.created_at}`);
    }
  } else {
    console.log("沒有找到此客戶編號的 Opportunity");
  }

  // 查詢 todos
  console.log("\nTodos with this customer_number:");
  const todoResult = await client.query(`
    SELECT id, title, customer_number, status, source, created_at
    FROM sales_todos
    WHERE customer_number = $1
    ORDER BY created_at DESC
  `, [customerNumber]);

  if (todoResult.rows.length === 0) {
    console.log("  (沒有找到)");
  } else {
    for (const todo of todoResult.rows) {
      console.log(`  ID: ${todo.id}`);
      console.log(`  Title: ${todo.title}`);
      console.log(`  Status: ${todo.status}`);
      console.log(`  Source: ${todo.source}`);
      console.log(`  Created: ${todo.created_at}`);
    }
  }

  await client.end();
}

checkCustomer().catch(console.error);
