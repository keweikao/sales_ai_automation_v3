import { db } from "@Sales_ai_automation_v3/db";
import { salesTodos } from "@Sales_ai_automation_v3/db/schema";

async function main() {
  console.log("Querying sales_todos...");
  
  const todos = await db.select().from(salesTodos).limit(20);
  
  console.log(`\nFound ${todos.length} todos:`);
  
  for (const todo of todos) {
    console.log(`\n- ID: ${todo.id}`);
    console.log(`  Title: ${todo.title}`);
    console.log(`  UserId: ${todo.userId}`);
    console.log(`  Source: ${todo.source}`);
    console.log(`  Status: ${todo.status}`);
    console.log(`  DueDate: ${todo.dueDate}`);
    console.log(`  CreatedAt: ${todo.createdAt}`);
  }
  
  process.exit(0);
}

main();
