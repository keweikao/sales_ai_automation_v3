import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  const result = await client.query(`
    SELECT customer_number, company_name, created_at
    FROM opportunities
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log("=== 最近 10 筆 Opportunities ===\n");
  for (const row of result.rows) {
    console.log(`${row.customer_number} | ${row.company_name}`);
  }

  console.log(`\n總共 ${result.rowCount} 筆`);

  await client.end();
}

main().catch(console.error);
