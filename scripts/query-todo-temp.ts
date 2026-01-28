import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { salesTodos } from '../packages/db/src/schema/sales-todo';
import { eq, like, or } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const todoId = '202601-123650';

async function main() {
  const results = await db.select().from(salesTodos).where(
    or(
      eq(salesTodos.id, todoId),
      like(salesTodos.id, '%' + todoId + '%')
    )
  );

  if (results.length === 0) {
    console.log('未找到 todo ID:', todoId);
    
    const byOpportunity = await db.select().from(salesTodos).where(
      or(
        eq(salesTodos.opportunityId, todoId),
        like(salesTodos.opportunityId, '%123650%')
      )
    ).limit(5);
    
    if (byOpportunity.length > 0) {
      console.log('\n找到相關 opportunity 的 todos:');
      console.log(JSON.stringify(byOpportunity, null, 2));
    } else {
      console.log('\n最近的 todos (作為參考):');
      const recent = await db.select().from(salesTodos).limit(3);
      console.log(JSON.stringify(recent.map(t => ({id: t.id, title: t.title, status: t.status})), null, 2));
    }
  } else {
    console.log(JSON.stringify(results, null, 2));
  }
}

main();
