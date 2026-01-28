import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { conversations } from '../packages/db/src/schema/conversation';
import { like, desc } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function main() {
  // 查詢包含 123650 的 conversations
  const convs = await db.select().from(conversations).where(like(conversations.id, '%123650%')).limit(5);
  console.log('=== 包含 123650 的 Conversations ===');
  if (convs.length === 0) {
    console.log('沒有找到');

    // 查看最近的 conversations
    const recentConvs = await db.select().from(conversations).orderBy(desc(conversations.createdAt)).limit(10);
    console.log('\n=== 最近的 Conversations (作為參考) ===');
    console.log(JSON.stringify(recentConvs.map(c => ({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt
    })), null, 2));
  } else {
    console.log(JSON.stringify(convs, null, 2));
  }
}

main();
