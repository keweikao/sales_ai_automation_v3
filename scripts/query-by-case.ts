import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { conversations } from '../packages/db/src/schema/conversation';
import { salesTodos } from '../packages/db/src/schema/sales-todo';
import { like, eq, desc } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const searchTerm = '123650';

async function main() {
  // 用 caseNumber 搜尋
  console.log(`=== 搜尋 caseNumber 包含 "${searchTerm}" ===`);
  const convsByCaseNum = await db.select().from(conversations)
    .where(like(conversations.caseNumber, `%${searchTerm}%`))
    .limit(5);

  if (convsByCaseNum.length > 0) {
    console.log('找到 conversations:');
    console.log(JSON.stringify(convsByCaseNum.map(c => ({
      id: c.id,
      caseNumber: c.caseNumber,
      title: c.title,
      status: c.status,
      storeName: c.storeName,
      createdAt: c.createdAt
    })), null, 2));

    // 查詢關聯的 todos
    for (const conv of convsByCaseNum) {
      const relatedTodos = await db.select().from(salesTodos)
        .where(eq(salesTodos.conversationId, conv.id));
      if (relatedTodos.length > 0) {
        console.log(`\n=== ${conv.caseNumber} 的相關 Todos ===`);
        console.log(JSON.stringify(relatedTodos, null, 2));
      }
    }
  } else {
    console.log('沒有找到');

    // 顯示所有有 caseNumber 的記錄
    console.log('\n=== 所有有 caseNumber 的 Conversations ===');
    const withCaseNum = await db.select().from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(10);
    console.log(JSON.stringify(withCaseNum.filter(c => c.caseNumber).map(c => ({
      caseNumber: c.caseNumber,
      title: c.title,
      status: c.status,
      storeName: c.storeName
    })), null, 2));
  }
}

main();
