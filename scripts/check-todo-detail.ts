import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  const result = await client.query(`
    SELECT
      t.id,
      t.title,
      t.customer_number,
      t.opportunity_id,
      t.conversation_id,
      c.case_number,
      c.title as conversation_title
    FROM sales_todos t
    LEFT JOIN conversations c ON t.conversation_id = c.id
    WHERE t.title = '是否付款'
    LIMIT 1
  `);

  const todo = result.rows[0];
  if (todo) {
    console.log("=== 待辦詳細資訊 ===");
    console.log(`Title: ${todo.title}`);
    console.log(`Customer Number: ${todo.customer_number || "(null)"}`);
    console.log(`Opportunity ID: ${todo.opportunity_id || "(null)"}`);
    console.log(`Conversation ID: ${todo.conversation_id || "(null)"}`);
    console.log(`Case Number: ${todo.case_number || "(null)"}`);
    console.log(`Conversation Title: ${todo.conversation_title || "(null)"}`);
  } else {
    console.log("找不到待辦");
  }

  await client.end();
}

main().catch(console.error);
