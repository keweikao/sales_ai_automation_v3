import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  // 查詢待辦的 customerNumber
  const todoResult = await client.query(`
    SELECT id, title, customer_number, opportunity_id
    FROM sales_todos
    WHERE title = '是否付款'
    LIMIT 1
  `);

  const todo = todoResult.rows[0];
  if (!todo) {
    console.log("找不到待辦");
    await client.end();
    return;
  }

  console.log("=== 待辦資訊 ===");
  console.log(`Title: ${todo.title}`);
  console.log(`Customer Number: ${todo.customer_number || "(null)"}`);
  console.log(`Opportunity ID: ${todo.opportunity_id || "(null)"}`);

  // 查詢對應的 opportunity
  if (todo.customer_number) {
    const oppResult = await client.query(`
      SELECT id, customer_number, company_name
      FROM opportunities
      WHERE customer_number = $1
      LIMIT 1
    `, [todo.customer_number]);

    if (oppResult.rows.length > 0) {
      const opp = oppResult.rows[0];
      console.log("\n=== 對應的 Opportunity ===");
      console.log(`ID: ${opp.id}`);
      console.log(`Customer Number: ${opp.customer_number}`);
      console.log(`Company Name: ${opp.company_name}`);
      console.log("\n結論：有對應的 opportunity，但待辦沒有正確關聯");
    } else {
      console.log("\n結論：找不到對應的 opportunity");
    }
  }

  await client.end();
}

main().catch(console.error);
