import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  await client.connect();

  console.log("=== sales_todos 表結構 ===\n");

  const todoColumns = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'sales_todos'
    ORDER BY ordinal_position
  `);

  for (const col of todoColumns.rows) {
    console.log(`${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
  }

  console.log("\n=== conversations 表結構 ===\n");

  const convColumns = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'conversations'
    ORDER BY ordinal_position
  `);

  for (const col of convColumns.rows) {
    console.log(`${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
  }

  await client.end();
}

checkSchema().catch(console.error);
