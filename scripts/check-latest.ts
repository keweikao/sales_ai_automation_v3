import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkLatest() {
  await client.connect();

  console.log("=== 最近 3 筆 Conversations ===\n");

  const convResult = await client.query(`
    SELECT c.id, c.case_number, c.status, c.created_at, o.customer_number, o.company_name
    FROM conversations c
    LEFT JOIN opportunities o ON c.opportunity_id = o.id
    ORDER BY c.created_at DESC
    LIMIT 3
  `);

  for (const conv of convResult.rows) {
    console.log(`Case: ${conv.case_number}`);
    console.log(`Customer Number: ${conv.customer_number}`);
    console.log(`Company: ${conv.company_name}`);
    console.log(`Status: ${conv.status}`);
    console.log(`Created: ${conv.created_at}`);
    console.log("---");
  }

  console.log("\n=== 最近 5 筆 Todos ===\n");

  const todoResult = await client.query(`
    SELECT id, title, customer_number, status, source, created_at
    FROM sales_todos
    ORDER BY created_at DESC
    LIMIT 5
  `);

  for (const todo of todoResult.rows) {
    console.log(`Title: ${todo.title}`);
    console.log(`Customer Number: ${todo.customer_number || "(null)"}`);
    console.log(`Status: ${todo.status}`);
    console.log(`Source: ${todo.source}`);
    console.log(`Created: ${todo.created_at}`);
    console.log("---");
  }

  await client.end();
}

checkLatest().catch(console.error);
