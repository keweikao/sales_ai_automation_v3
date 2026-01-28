import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkData() {
  await client.connect();

  // 查詢 opportunities 表結構
  console.log("=== opportunities 表中與 customer 相關欄位 ===\n");
  const oppColumns = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'opportunities'
      AND column_name LIKE '%customer%'
    ORDER BY ordinal_position
  `);
  for (const col of oppColumns.rows) {
    console.log(`${col.column_name}: ${col.data_type}`);
  }

  // 查詢案件 202601-IC017 的相關資料
  console.log("\n=== 案件 202601-IC017 ===\n");
  const convResult = await client.query(`
    SELECT
      id,
      opportunity_id,
      case_number,
      status,
      created_at
    FROM conversations
    WHERE case_number = '202601-IC017'
    LIMIT 1
  `);

  if (convResult.rows.length > 0) {
    const conv = convResult.rows[0];
    console.log("Conversation found:");
    console.log(`  ID: ${conv.id}`);
    console.log(`  Opportunity ID: ${conv.opportunity_id}`);
    console.log(`  Case Number: ${conv.case_number}`);
    console.log(`  Status: ${conv.status}`);
    console.log(`  Created: ${conv.created_at}`);

    // 查詢 opportunity
    console.log("\nOpportunity:");
    const oppResult = await client.query(`
      SELECT
        id,
        customer_number,
        company_name,
        contact_name,
        status,
        created_at
      FROM opportunities
      WHERE id = $1
    `, [conv.opportunity_id]);

    if (oppResult.rows.length > 0) {
      const opp = oppResult.rows[0];
      console.log(`  ID: ${opp.id}`);
      console.log(`  Customer Number: ${opp.customer_number}`);
      console.log(`  Company: ${opp.company_name}`);
      console.log(`  Contact: ${opp.contact_name}`);
      console.log(`  Status: ${opp.status}`);
    }
  } else {
    console.log("沒有找到 202601-IC017");
  }

  // 查詢客戶編號 202609-000001 的 opportunity
  console.log("\n=== 客戶編號 202609-000001 ===\n");
  const custResult = await client.query(`
    SELECT
      id,
      customer_number,
      company_name,
      contact_name,
      status,
      created_at
    FROM opportunities
    WHERE customer_number = '202609-000001'
    ORDER BY created_at DESC
    LIMIT 3
  `);

  for (const opp of custResult.rows) {
    console.log(`ID: ${opp.id}`);
    console.log(`Customer Number: ${opp.customer_number}`);
    console.log(`Company: ${opp.company_name}`);
    console.log(`Status: ${opp.status}`);
    console.log(`Created: ${opp.created_at}`);
    console.log("---");
  }

  // 查詢 sales_todos 有 customer_number 的
  console.log("\n=== 有 customer_number 的 Todos ===\n");
  const todosWithCN = await client.query(`
    SELECT
      id,
      title,
      customer_number,
      source,
      created_at
    FROM sales_todos
    WHERE customer_number IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  `);

  if (todosWithCN.rows.length === 0) {
    console.log("沒有任何 Todo 有 customer_number");
  } else {
    for (const todo of todosWithCN.rows) {
      console.log(`ID: ${todo.id}`);
      console.log(`Title: ${todo.title}`);
      console.log(`Customer Number: ${todo.customer_number}`);
      console.log(`Source: ${todo.source}`);
      console.log(`Created: ${todo.created_at}`);
      console.log("---");
    }
  }

  await client.end();
}

checkData().catch(console.error);
