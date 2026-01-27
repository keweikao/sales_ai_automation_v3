import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { salesTodos } from '../packages/db/src/schema/sales-todo';
import { opportunities } from '../packages/db/src/schema/opportunity';
import { like } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  // 查詢所有 todos
  const allTodos = await db.select().from(salesTodos).limit(10);
  console.log('=== 所有 Todos (最多 10 筆) ===');
  if (allTodos.length === 0) {
    console.log('資料庫中沒有 todos');
  } else {
    console.log(JSON.stringify(allTodos.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status,
      opportunityId: t.opportunityId
    })), null, 2));
  }

  // 查詢包含 123650 的 opportunities
  const opps = await db.select().from(opportunities).where(like(opportunities.id, '%123650%')).limit(5);
  console.log('\n=== 包含 123650 的 Opportunities ===');
  if (opps.length === 0) {
    console.log('沒有找到');

    // 查看最近的 opportunities
    const recentOpps = await db.select().from(opportunities).limit(5);
    console.log('\n=== 最近的 Opportunities (作為參考) ===');
    console.log(JSON.stringify(recentOpps.map(o => ({
      id: o.id,
      companyName: o.companyName
    })), null, 2));
  } else {
    console.log(JSON.stringify(opps.map(o => ({
      id: o.id,
      companyName: o.companyName
    })), null, 2));
  }
}

main();
