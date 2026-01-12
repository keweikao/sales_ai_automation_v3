// scripts/migration/check-firestore.ts
import { firestore } from "./config";

async function checkFirestore() {
  console.log("檢查 Firestore 資料...\n");

  try {
    // 列出所有 collections
    const collections = await firestore.listCollections();
    console.log("所有 Collections:");
    for (const col of collections) {
      const snapshot = await col.count().get();
      console.log(`  - ${col.id}: ${snapshot.data().count} 筆`);
    }

    console.log("\n");

    // 檢查 leads
    const leadsSnapshot = await firestore.collection("leads").limit(3).get();
    console.log(`leads 集合樣本 (${leadsSnapshot.size} 筆):`);
    for (const doc of leadsSnapshot.docs) {
      console.log(`  - ${doc.id}:`, JSON.stringify(doc.data()).substring(0, 100) + "...");
    }

    // 檢查 sales_cases
    const casesSnapshot = await firestore.collection("sales_cases").limit(3).get();
    console.log(`\nsales_cases 集合樣本 (${casesSnapshot.size} 筆):`);
    for (const doc of casesSnapshot.docs) {
      console.log(`  - ${doc.id}:`, JSON.stringify(doc.data()).substring(0, 100) + "...");
    }

  } catch (error) {
    console.error("查詢失敗:", error);
  }
}

checkFirestore();
