// scripts/migration/check-cases.ts
import { firestore } from "./config";

async function checkCases() {
  console.log("檢查 Firestore cases 集合結構...\n");

  try {
    // 取得 cases 樣本
    const casesSnapshot = await firestore.collection("cases").limit(3).get();
    console.log(`cases 集合樣本 (共 ${casesSnapshot.size} 筆):\n`);

    for (const doc of casesSnapshot.docs) {
      console.log(`=== ${doc.id} ===`);
      const data = doc.data();
      console.log("欄位:", Object.keys(data).join(", "));
      console.log("資料:", JSON.stringify(data, null, 2).substring(0, 500));
      console.log("\n");
    }

  } catch (error) {
    console.error("查詢失敗:", error);
  }
}

checkCases();
