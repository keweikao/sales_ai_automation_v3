import postgres from "postgres";
import "dotenv/config";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!);

  console.log("Querying sales_todos...");

  const todos =
    await sql`SELECT * FROM sales_todos ORDER BY created_at DESC LIMIT 20`;

  console.log(`\nFound ${todos.length} todos:`);

  for (const todo of todos) {
    console.log(`\n- ID: ${todo.id}`);
    console.log(`  Title: ${todo.title}`);
    console.log(`  UserId: ${todo.user_id}`);
    console.log(`  Source: ${todo.source}`);
    console.log(`  Status: ${todo.status}`);
    console.log(`  DueDate: ${todo.due_date}`);
    console.log(`  CreatedAt: ${todo.created_at}`);
  }

  await sql.end();
  process.exit(0);
}

main();
