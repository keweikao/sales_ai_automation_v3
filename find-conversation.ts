import { desc, eq } from "drizzle-orm";
import { db } from "./packages/db/src";
import { conversations } from "./packages/db/src/schema";

async function findConversation() {
  console.log("🔍 尋找案件編號 202601-IC021...");

  const result = await db
    .select()
    .from(conversations)
    .where(eq(conversations.caseNumber, "202601-IC021"))
    .limit(1);

  if (result.length === 0) {
    console.log("❌ 找不到此案件");

    // 列出最近的對話
    console.log("\n📋 最近的對話:");
    const recent = await db
      .select({
        id: conversations.id,
        caseNumber: conversations.caseNumber,
        title: conversations.title,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .orderBy(desc(conversations.createdAt))
      .limit(5);

    for (const conv of recent) {
      console.log(`  - ${conv.caseNumber}: ${conv.title} (${conv.id})`);
    }

    return;
  }

  const conv = result[0];
  console.log("\n✅ 找到對話:");
  console.log("ID:", conv.id);
  console.log("案件編號:", conv.caseNumber);
  console.log("標題:", conv.title);
  console.log("商機 ID:", conv.opportunityId);

  // 輸出 API 調用命令
  console.log("\n📡 重新觸發通知的命令:");
  console.log(
    "curl -X POST https://sales-ai-server.salesaiautomationv3.workers.dev/rpc/conversations/analyze \\"
  );
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(
    `  -H "Authorization: Bearer 01cc199c38cd72f6acd34bc833384fda58afbf3b0d2f426b4ae0a7bf1415b33f" \\`
  );
  console.log(`  -d '{"json": {"conversationId": "${conv.id}"}}'`);
}

findConversation().catch(console.error);
