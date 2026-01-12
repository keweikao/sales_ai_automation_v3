// scripts/migration/test-single-insert.ts
/**
 * 測試單一 conversation 插入
 */

import { conversations } from "../../packages/db/src/schema";
import { db, firestore } from "./config";
import { mapCaseToConversation, normalizeCustomerId } from "./mappers/v2-mapper";
import { parseV2Case } from "./types-v2";

async function main() {
  console.log("測試單一 conversation 插入...\n");

  // 讀取第一筆 case
  const casesSnapshot = await firestore.collection("cases").limit(1).get();
  const doc = casesSnapshot.docs[0];
  const v2Case = parseV2Case(doc.id, doc.data());

  console.log("Case 資料:");
  console.log(`  caseId: ${v2Case.caseId}`);
  console.log(`  customerId: ${v2Case.customerId}`);
  console.log(`  customerName: ${v2Case.customerName}`);
  console.log(`  status: ${v2Case.status}`);

  const opportunityId = normalizeCustomerId(v2Case.customerId);
  console.log(`  正規化後 opportunityId: ${opportunityId}`);

  const conversation = mapCaseToConversation(v2Case, opportunityId);

  console.log("\nConversation 資料:");
  console.log(`  id: ${conversation.id}`);
  console.log(`  opportunityId: ${conversation.opportunityId}`);
  console.log(`  title: ${conversation.title}`);
  console.log(`  transcript 長度: ${JSON.stringify(conversation.transcript || {}).length} 字元`);

  try {
    console.log("\n嘗試插入...");
    await db.insert(conversations).values(conversation).onConflictDoNothing();
    console.log("✅ 插入成功！");
  } catch (error) {
    console.log("❌ 插入失敗:");
    console.log(error);

    if (error instanceof Error) {
      console.log("\n錯誤詳情:");
      console.log(`  message: ${error.message}`);
      console.log(`  name: ${error.name}`);

      // 嘗試打印更多詳情
      const anyError = error as Record<string, unknown>;
      for (const key of Object.keys(anyError)) {
        if (key !== 'message' && key !== 'name' && key !== 'stack') {
          console.log(`  ${key}: ${JSON.stringify(anyError[key])}`);
        }
      }
    }
  }
}

main();
